import { NextFunction, Request, Response } from 'express'

interface CorsOption {
    origin?: string
    methods?: string | string[]
    preflightContinue?: boolean
    optionsSuccessStatus?: number
    credentials?: boolean,
    allowedHeaders?: string | string[],
    exposedHeaders?: string | string[],
    maxAge?: number | string
}

interface KeyValue {
    key: string,
    value: string
}

const parseString = (s: string | string[]): string => {
    return Array.isArray(s) ? s.join(',') : s
}

export default class Cors {
    private options: CorsOption

    constructor(options?: CorsOption) {
        if (!options.origin)
            options.origin = '*'
        if (!options.methods)
            options.methods = 'GET,HEAD,PUT,PATCH,POST,DELETE'
        if (!options.preflightContinue)
            options.preflightContinue = false
        if (!options.optionsSuccessStatus)
            options.optionsSuccessStatus = 204
        this.options = options
    }

    use(req: Request, res: Response, next: NextFunction) {
        var headers: KeyValue[] = [],
            method = req.method && req.method.toUpperCase && req.method.toUpperCase()

        if (method === 'OPTIONS') {
            // preflight
            headers.push(...configureOrigin(this.options, req))
            headers.push(...configureCredentials(this.options))
            headers.push(...configureMethods(this.options))
            headers.push(...configureAllowedHeaders(this.options, req))
            headers.push(...configureMaxAge(this.options))
            headers.push(...configureExposedHeaders(this.options))
            applyHeaders(headers, res)

            if (this.options.preflightContinue) {
                next()
            } else {
                // Safari (and potentially other browsers) need content-length 0,
                //   for 204 or they just hang waiting for a body
                res.statusCode = this.options.optionsSuccessStatus
                res.setHeader('Content-Length', '0')
                res.end()
            }
        } else {
            // actual response
            headers.push(...configureOrigin(this.options, req))
            headers.push(...configureCredentials(this.options))
            headers.push(...configureExposedHeaders(this.options))
            applyHeaders(headers, res)
            next()
        }
    }
}

function configureOrigin(options: CorsOption, req: Request): KeyValue[] {
    const headers: KeyValue[] = []

    if (!options.origin)
        // allow any origin
        headers.push({
            key: 'Access-Control-Allow-Origin',
            value: '*'
        })
    else {
        // fixed origin
        headers.push({
            key: 'Access-Control-Allow-Origin',
            value: options.origin
        })
        headers.push({
            key: 'Vary',
            value: 'Origin'
        })
    }

    return headers
}

function configureMethods(options: CorsOption): KeyValue[] {
    let methods = options.methods
    if (Array.isArray(methods)) {
        methods = methods.join(',') // .methods is an array, so turn it into a string
    }
    return [{
        key: 'Access-Control-Allow-Methods',
        value: methods
    }]
}

function configureCredentials(options: CorsOption): KeyValue[] {
    if (options.credentials) {
        return [{
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
        }]
    }
    return []
}

function configureAllowedHeaders(options: CorsOption, req: Request): KeyValue[] {
    let allowedHeaders = options.allowedHeaders
    const headers: KeyValue[] = []

    if (!allowedHeaders) {
        allowedHeaders = req.headers['access-control-request-headers'] // .headers wasn't specified, so reflect the request headers
        headers.push({
            key: 'Vary',
            value: 'Access-Control-Request-Headers'
        })
    } else
        allowedHeaders = parseString(allowedHeaders)

    if (allowedHeaders && allowedHeaders.length > 0)
        headers.push({
            key: 'Access-Control-Allow-Headers',
            value: allowedHeaders
        })

    return headers
}

function configureExposedHeaders(options: CorsOption): KeyValue[] {
    var headers = options.exposedHeaders

    if (!headers)
        return []
    else
        headers = parseString(headers)

    if (headers && headers.length > 0)
        return [{
            key: 'Access-Control-Expose-Headers',
            value: headers
        }]

    return []
}

function configureMaxAge(options: CorsOption): KeyValue[] {
    let maxAge = options.maxAge

    if (maxAge) {
        maxAge = maxAge.toString()
        if (maxAge.length > 0)
            return [{
                key: 'Access-Control-Max-Age',
                value: maxAge
            }]
    }

    return []
}

function applyHeaders(headers: KeyValue[], res: Response) {
    for (var i = 0, n = headers.length; i < n; i++) {
        var header = headers[i]
        if (header) {
            if (Array.isArray(header)) {
                applyHeaders(header, res)
            } else if (header.key === 'Vary' && header.value) {
                vary(res, header.value)
            } else if (header.value) {
                res.setHeader(header.key, header.value)
            }
        }
    }
}

function vary(res: Response, field: string) {
    if (!res || !res.getHeader || !res.setHeader)
        throw new TypeError('res argument is required')

    // get existing header
    let val = res.getHeader('Vary') || ''
    const header = Array.isArray(val)
        ? val.join(', ')
        : String(val)

    // set new header
    val = append(header, field)
    if (val && val.length > 0) {
        res.setHeader('Vary', val)
    }
}

const FIELD_NAME_REGEXP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function append(header: string, field: string): string {

    // existing, unspecified vary
    if (header === '*') {
        return header
    }

    // get fields array
    const fields = !Array.isArray(field)
        ? parse(field)
        : field

    // assert on invalid field names
    for (var j = 0; j < fields.length; j++) {
        if (!FIELD_NAME_REGEXP.test(fields[j])) {
            throw new TypeError('field argument contains an invalid header name')
        }
    }

    // enumerate current values
    let val = header
    const vals = parse(header.toLowerCase())

    // unspecified vary
    if (fields.indexOf('*') !== -1 || vals.indexOf('*') !== -1) {
        return '*'
    }

    for (var i = 0; i < fields.length; i++) {
        var fld = fields[i].toLowerCase()

        // append value (case-preserving)
        if (vals.indexOf(fld) === -1) {
            vals.push(fld)
            val = val
                ? val + ', ' + fields[i]
                : fields[i]
        }
    }

    return val
}

function parse(header: string): string[] {
    let end = 0, start = 0
    const list: string[] = []

    // gather tokens
    for (var i = 0, len = header.length; i < len; i++) {
        switch (header.charCodeAt(i)) {
            case 0x20: /*   */
                if (start === end) {
                    start = end = i + 1
                }
                break
            case 0x2c: /* , */
                list.push(header.substring(start, end))
                start = end = i + 1
                break
            default:
                end = i + 1
                break
        }
    }

    // final token
    list.push(header.substring(start, end))

    return list
}