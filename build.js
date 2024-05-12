const fs = require("fs")

const content = 
`
{
    "scripts": {
        "start": "node StartUp.js"
    },
    "dependencies": {
        "@octokit/rest": "^20.0.2",
        "express": "^4.18.2",
        "google-auth-library": "^9.4.2",
        "jsonwebtoken": "^9.0.2",
        "mongodb": "^6.3.0",
        "multer": "^1.4.5-lts.1"
    },
    "engines": {
        "node": ">=14"
    }
}
`


fs.writeFile("./dist/package.json", content, () => {
    console.info("Build done!")
})