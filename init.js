const { Octokit } = require('@octokit/rest')
const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const env = JSON.parse(fs.readFileSync("./etc/secrets/config.json", "utf8"))
const octokit = new Octokit({
    auth: env.GitHub.token
})
const client = new MongoClient(env.Mongodb.url, {
    tlsCertificateKeyFile: "./etc/secrets/cert.pem",
    serverApi: ServerApiVersion.v1
})
client.connect()
const cursor = client.db(env.Mongodb.database).collection("Cursor")

octokit.repos.createOrUpdateFileContents({
    owner: env.GitHub.owner,
    repo: env.GitHub.repo,
    branch: env.GitHub.branch,
    path: "topics",
    sha: "",
    content: "",
    message: env.GitHub.message
}).then(x => {
    cursor.updateOne({ _id: 0 }, { $set: { "shaTopics": x.data.content.sha } }).then(x => {
        console.log(x)
    })
})