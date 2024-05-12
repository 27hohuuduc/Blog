import { NextFunction, Request, Response, Router } from "express"
import { InvalidFileTypeError, InvalidJSONError, UnauthorizedError } from "../modules/SelfDefinedError"
import BaseController from "./_BaseController"
import ValidFiles from "../modules/ValidFiles"
import jwt from "jsonwebtoken"
import multer from "multer"
import GithubContext from "../modules/GitHubContext"
import Singleton from "../Singleton"
import Authencation from "../modules/Authencation"

interface SelfPayload {
    role: string,
    iat: number
}

interface SelfRequest extends Request {
    token: SelfPayload
}

interface UploadRequest extends Request {
    body: {
        title: string,
        parent: number,
        index: number,
        contents: string
    }
}

interface SelfFile extends Express.Multer.File {
    storagetype: string
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2097152 },
    fileFilter: (req, file: SelfFile, cb) => {
        const type = ValidFiles.find((x) => x.mimetype === file.mimetype)
        if (type) {
            file.storagetype = type.storagetype
            cb(null, true)
        }
        else {
            cb(new InvalidFileTypeError)
        }
    }
})

export default class PrivateController extends BaseController {
    private justLoggedOut: { role: string, validTime: number }[] = []

    constructor(
        private github: GithubContext = Singleton.getInstance(GithubContext),
        private authencation: Authencation = Singleton.getInstance(Authencation)) {

        super()

        //Verification
        const router = Router().use(this.verifyHandle.bind(this))

        router.get("/logout", this.logoutHandle.bind(this))

        router.post("/upload",
            upload.fields([{ name: 'file', maxCount: 20 }, { name: "title", maxCount: 1 }, { name: "parent", maxCount: 1 }, { name: "index", maxCount: 1 }, { name: "contents", maxCount: 1 }]),
            this.uploadHandle.bind(this)
        )

        //Refresh
        router.get("/login", this.loginHandle.bind(this))

        router.get("/test", (req, res) => {
            res.json({ status: 200 })
        })

        this.router = Router().use(router)
    }

    async verifyHandle(req: SelfRequest, res: Response, next: NextFunction) {
        try {
            const arr = req.headers.cookie.split("; ")
            let token: string, i = 0

            for (; i < arr.length; i++) {
                if (arr[i].substring(0, 6) === "token=") {
                    token = arr[i].substring(6, arr[i].length)
                    break
                }
            }

            if (!token)
                throw UnauthorizedError

            const payload = jwt.verify(token, this.env.variables.SecretKey) as SelfPayload
            if (this.justLoggedOut.find(x => x.role === payload.role && x.validTime > payload.iat))
                throw UnauthorizedError
            req.token = payload
            next()
        }
        catch {
            next(new UnauthorizedError)
        }
    }

    logoutHandle(req: SelfRequest, res: Response) {
        const role = req.token.role
        const result = this.justLoggedOut.find(x => x.role === role)
        if (result)
            result.validTime = Date.now()
        else
            this.justLoggedOut.push({ role: role, validTime: Date.now() })
        res.json({ status: 200 })
    }

    loginHandle(req: SelfRequest, res: Response, next: NextFunction) {
        try {
            this.authencation.verify(req.token.role, res)
        } catch {
            next(new UnauthorizedError())
        }
    }

    async uploadHandle(req: UploadRequest, res: Response, next: NextFunction) {
        try {
            const title = req.body.title
            if (isEmpty(title)) {
                res.status(400).send("Title can't be empty.")
                return
            }

            const contents = req.body.contents
            if (isEmpty(contents)) {
                res.status(400).send("Contents can't be empty.")
                return
            }

            const parent = Number(req.body.parent)
            const index = Number(req.body.index)
            const now = Date.now()
            const body = JSON.stringify({ title, parent, index }).concat(now.toString(), contents)

            const uploadTopicResult = await this.github.post(now.toString(), hexiToDeci(body))
            if (uploadTopicResult.status != 201) {
                throw new Error("Can't upload to Github.")
            }
            else {
                const updateDbResult = await this.db.contents.insertOne({
                    id: now,
                    parentId: parent,
                    index: index,
                    topic: title,
                    url: uploadTopicResult.data.content.download_url,
                    sha: uploadTopicResult.data.content.sha
                })
                if (!updateDbResult.acknowledged) {
                    throw new Error("Can't update data.")
                }
            }
            this.upadteTopics()
            // req.files["file"].forEach((f: SelfFile) => {
            //     this.github.post(`${Date.now().toString()}.${f.storagetype}`, f.buffer, (x) => {
            //         console.log(x)
            //     })
            // })

            res.json({ status: 200, id: now })
        } catch (err) {
            if (err instanceof SyntaxError)
                next(new InvalidJSONError)
            else
                next(err)
            return
        }
    }

    private processing = false
    private hasNew = false
    private async upadteTopics(isRecurse: boolean = false) {
        if (this.processing && !isRecurse) {
            this.hasNew = true
            return
        }
        this.processing = true
        this.hasNew = false
        try {
            const result = await this.db.contents.find().project({ _id: 0, id: 1, parentId: 1, index: 1, topic: 1 }).toArray()
            console.log(await this.db.cursor)
            this.db.shaTopics = (await this.github.post("topics", hexiToDeci(JSON.stringify(result)), (await this.db.cursor).shaTopics)).data.content.sha
            if (this.hasNew)
                await this.upadteTopics(true)
        } catch (e) {
            console.log(e)
        }
        this.processing = false
    }
}

const isEmpty = (s: string) => (!s || s.length == 0 || s.trim().length == 0)

const hexiToDeci = (s: string) => {
    const codeUnits = new Uint16Array(s.length)
    for (let i = 0; i < codeUnits.length; i++) {
        codeUnits[i] = s.charCodeAt(i)
    }
    return String.fromCharCode(...new Uint8Array(codeUnits.buffer))
}