import { NextFunction, Request, Response, Router } from "express"
import { User } from "../modules/MongoDBContext"
import { Filter } from "mongodb"
import { InvalidQueryError, UnauthorizedError } from "../modules/SelfDefinedError"
import { OAuth2Client } from "google-auth-library"
import BaseController from "./_BaseController"
import PrivateController from "./PrivateController"
import Singleton from "../Singleton"
import Authencation from "../modules/Authencation"
import Cors from "../library/Cors"
import bodyParser from "body-parser"

export default class ApiController extends BaseController {

    constructor(
        privateController: PrivateController = Singleton.getInstance(PrivateController),
        private authencation: Authencation = Singleton.getInstance(Authencation),
        private oAuth2Client: OAuth2Client = new OAuth2Client()) {

        super()

        const router = Router()

        //Middleware
        const cors = new Cors({
            origin: this.env.variables.Origin,
            credentials: this.env.debug
        })
        router.use(cors.use.bind(cors))

        router.use(bodyParser.json())

        //Debug
        router.post("/debug", (req: Request, res: Response) => {
            res.json(req.body)
        })

        //Auth
        router.post("/login", this.loginHandle.bind(this))

        router.use(privateController.router)

        //NotFound
        router.use((req, res, next) => {
            res.status(404).send('Not Found')
        })

        this.router = Router().use("/api", router)

    }

    async loginHandle(req: Request, res: Response, next: NextFunction) {
        let query: Filter<User>
        try {
            if (req.body.password)
                query = { pass: req.body.password }
            else if (req.body.token) {
                query = await this.oAuth2Client.verifyIdToken({
                    idToken: req.body.token
                }).then(ticket => { return { google: ticket.getUserId() } })
            }
            else {
                next(new InvalidQueryError())
                return
            }
            const user = await this.db.users.findOne(query)
            if (user) {
                this.authencation.verify(user.role, res)
            }
            else {
                throw UnauthorizedError
            }
        } catch {
            next(new UnauthorizedError())
        }
    }
}