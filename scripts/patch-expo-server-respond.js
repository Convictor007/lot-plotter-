/**
 * expo-server@1.x pipes API responses with stream.pipeline(); if the browser disconnects
 * (HMR, refresh, fast navigation), Node throws "Cannot pipe to a closed or destroyed stream".
 * Guard + try/catch mirrors upstream expo fixes (client-close races on Windows/dev).
 * Idempotent: safe to run on every npm install.
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'iassess-guard-respond-stream';

const MJS_PATH = path.join(__dirname, '..', 'node_modules', 'expo-server', 'build', 'mjs', 'vendor', 'http.js');
const CJS_PATH = path.join(__dirname, '..', 'node_modules', 'expo-server', 'build', 'cjs', 'vendor', 'http.js');

const MJS_OLD = `export async function respond(res, expoRes) {
    res.statusMessage = expoRes.statusText;
    res.statusCode = expoRes.status;
    if (typeof res.setHeaders === 'function') {
        res.setHeaders(expoRes.headers);
    }
    else {
        for (const [key, value] of expoRes.headers.entries()) {
            res.appendHeader(key, value);
        }
    }
    if (expoRes.body) {
        await pipeline(Readable.fromWeb(expoRes.body), res);
    }
    else {
        res.end();
    }
}`;

const MJS_NEW = `export async function respond(res, expoRes) {
    // ${MARKER}
    if (res.destroyed || res.writableEnded) {
        return;
    }
    res.statusMessage = expoRes.statusText;
    res.statusCode = expoRes.status;
    if (typeof res.setHeaders === 'function') {
        res.setHeaders(expoRes.headers);
    }
    else {
        for (const [key, value] of expoRes.headers.entries()) {
            res.appendHeader(key, value);
        }
    }
    if (expoRes.body) {
        try {
            if (!res.destroyed && !res.writableEnded) {
                await pipeline(Readable.fromWeb(expoRes.body), res);
            }
        }
        catch (err) {
            if (res.destroyed || res.writableEnded) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('closed') || msg.includes('destroyed')) {
                return;
            }
            throw err;
        }
    }
    else {
        if (!res.destroyed && !res.writableEnded) {
            res.end();
        }
    }
}`;

const CJS_OLD = `async function respond(res, expoRes) {
    res.statusMessage = expoRes.statusText;
    res.statusCode = expoRes.status;
    if (typeof res.setHeaders === 'function') {
        res.setHeaders(expoRes.headers);
    }
    else {
        for (const [key, value] of expoRes.headers.entries()) {
            res.appendHeader(key, value);
        }
    }
    if (expoRes.body) {
        await (0, promises_1.pipeline)(node_stream_1.Readable.fromWeb(expoRes.body), res);
    }
    else {
        res.end();
    }
}`;

const CJS_NEW = `async function respond(res, expoRes) {
    // ${MARKER}
    if (res.destroyed || res.writableEnded) {
        return;
    }
    res.statusMessage = expoRes.statusText;
    res.statusCode = expoRes.status;
    if (typeof res.setHeaders === 'function') {
        res.setHeaders(expoRes.headers);
    }
    else {
        for (const [key, value] of expoRes.headers.entries()) {
            res.appendHeader(key, value);
        }
    }
    if (expoRes.body) {
        try {
            if (!res.destroyed && !res.writableEnded) {
                await (0, promises_1.pipeline)(node_stream_1.Readable.fromWeb(expoRes.body), res);
            }
        }
        catch (err) {
            if (res.destroyed || res.writableEnded) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('closed') || msg.includes('destroyed')) {
                return;
            }
            throw err;
        }
    }
    else {
        if (!res.destroyed && !res.writableEnded) {
            res.end();
        }
    }
}`;

function patchFile(filePath, oldSrc, newSrc, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-expo-server] skip ${label}: file not found`);
    return;
  }
  let s = fs.readFileSync(filePath, 'utf8');
  if (s.includes(MARKER)) {
    return;
  }
  if (s.includes('respond(res, expoRes)') && s.includes('if (res.destroyed || res.writableEnded)')) {
    return;
  }
  if (!s.includes(oldSrc)) {
    console.warn(`[patch-expo-server] skip ${label}: unexpected content (expo-server may have upgraded)`);
    return;
  }
  s = s.replace(oldSrc, newSrc);
  fs.writeFileSync(filePath, s, 'utf8');
  console.log(`[patch-expo-server] patched ${label}`);
}

patchFile(MJS_PATH, MJS_OLD, MJS_NEW, 'expo-server mjs');
patchFile(CJS_PATH, CJS_OLD, CJS_NEW, 'expo-server cjs');
