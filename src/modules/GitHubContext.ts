import { Octokit } from "@octokit/rest"
import Singleton from "../Singleton"
import Environment, { Config } from "../Environment"

export default class GithubContext {

    constructor(
        private env = Singleton.getInstance(Environment).variables.GitHub,
        private octokit: Octokit = new Octokit({
            auth: env.token,
        })) { }

    private syncQueue: { resolve: Function, reject: Function, param: { name: string, body: Buffer | string, sha: string } }[] = []

    post(name: string, body: Buffer | string, sha: string = ""): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.syncQueue.push({ resolve, reject, param: { name, body, sha } })
            this.syncExecute()
        })
    }

    private processing = false
    private async syncExecute() {
        if (this.processing)
            return
        this.processing = true
        while (this.syncQueue.length > 0) {
            const item = this.syncQueue.shift()
            try {
                let body = item.param.body
                if (body instanceof Buffer)
                    body = body.toString('base64')
                else
                    body = btoa(body)
                item.resolve(
                    await this.octokit.repos.createOrUpdateFileContents({
                        owner: this.env.owner,
                        repo: this.env.repo,
                        branch: this.env.branch,
                        path: item.param.name,
                        sha: item.param.sha,
                        content: body,
                        message: this.env.message
                    })
                )
            }
            catch (ex) {
                item.reject(ex)
            }
        }
        this.processing = false
    }
}