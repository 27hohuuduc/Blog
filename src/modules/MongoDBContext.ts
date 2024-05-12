import { Collection, MongoClient, ServerApiVersion } from "mongodb"
import Environment from "../Environment"
import Singleton from "../Singleton"

export interface User {
    role: string,
    pass: string[],
    google: string[],
    valid_date: number
}

export interface Contents {
    topic: string,
    id: number,
    parentId: number,
    index: number,
    url: string,
    sha: string
}

interface Cursor {
    _id: number,
    shaTopics: string
}

export default class MongoDBContext {

    private _cursor: Cursor = null
    private _usersContext: Collection<User>
    private _contentsContext: Collection<Contents>
    private _cursorContext: Collection<Cursor>

    public get users() {
        return this._usersContext
    }
    public get contents() {
        return this._contentsContext
    }

    public get cursor(): Promise<Cursor> {
        return new Promise<Cursor>((resolve, reject) => {
            if (this._cursor)
                resolve(this._cursor)
            else
                this._cursorContext.findOne({ _id: 0 })
                    .then(x => {
                        this._cursor = x
                        resolve(this._cursor)
                    })
                    .catch(err => { reject(err) })
        })
    }

    public set shaTopics(value: string) {
        if (this._cursor)
            this._cursor.shaTopics = value
        this._cursorContext.updateOne({ _id: 0 }, { $set: { "shaTopics": value } })
    }

    constructor() {
        const env = Singleton.getInstance(Environment)
        const client = new MongoClient(env.variables.Mongodb.url, {
            tlsCertificateKeyFile: env.root + "cert.pem",
            serverApi: ServerApiVersion.v1
        })
        client.connect()
        const database = client.db(env.variables.Mongodb.database)
        this._usersContext = database.collection<User>("User")
        this._contentsContext = database.collection<Contents>("Contents")
        this._cursorContext = database.collection<Cursor>("Cursor")
    }
}