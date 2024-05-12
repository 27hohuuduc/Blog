import jwt from "jsonwebtoken"
import Singleton from "../Singleton";
import Environment from "../Environment";
import { Response } from "express";
export default class Authencation {

    constructor(private env = Singleton.getInstance(Environment).variables) { }

    verify(role: string, res: Response) {
        const token = jwt.sign({
            role: role,
            iat: Date.now()
        }, this.env.SecretKey, {
            expiresIn: this.env.Expires
        })

        res.cookie('token', token, {
            expires: new Date(Date.now() + this.env.Expires),
            maxAge: this.env.Expires,
            domain: res.req.hostname,
            httpOnly: true,
            secure: true

        }).json({ status: 200, timmeout: this.env.Expires })
    }
}





