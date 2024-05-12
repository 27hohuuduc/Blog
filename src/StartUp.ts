import express, { Express } from "express"
import Environment from "./Environment"
import Singleton from "./Singleton"
import { InvalidFileTypeError, InvalidJSONError, InvalidQueryError, UnauthorizedError } from "./modules/SelfDefinedError"
import ApiController from "./routers/ApiController"

class StartUp {

    constructor(private app: Express = express(),
        private apiController: ApiController = Singleton.getInstance(ApiController),
        private env: Environment = Singleton.getInstance(Environment)) { }

    run() {

        //Router
        this.app.use(this.apiController.router)

        this.app.use((req, res, next) => {
            res.redirect("https://27hohuuduc.github.io")
        })

        this.app.use((err, req, res, next) => {
            switch (true) {
                case err instanceof UnauthorizedError:
                    res.status(401).send("Authentication failed.")
                    break
                case err instanceof InvalidFileTypeError:
                    res.status(400).send("Invalid file type.")
                    break
                case err instanceof InvalidJSONError:
                    res.status(400).send("Invalid JSON string.")
                    break
                case err instanceof InvalidQueryError:
                    res.status(400).send("Invalid Query.")
                    break
                default:
                    res.status(500).send(this.env.debug ? err : "Something failed!")
            }
            return
        })

        //Start
        const server = this.app.listen(this.env.port, () => console.log(`Example app listening on port ${this.env.port}!`))

        server.keepAliveTimeout = 2 * 1000
        server.headersTimeout = 5000
        server.timeout = 2 * 1000
        server.requestTimeout = 10000
        server.setTimeout(30000)
    }
}

Singleton.getInstance(StartUp).run()