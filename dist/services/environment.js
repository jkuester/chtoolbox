"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentService = void 0;
const effect_1 = require("effect");
const COUCH_URL_PATTERN = /^(https?:\/\/([^:]+):[^/]+).*$/;
const parseCouchUrl = (url) => url.pipe(effect_1.Redacted.value, effect_1.String.match(COUCH_URL_PATTERN), effect_1.Option.map(([, url, user]) => ({
    url: effect_1.Redacted.make(`${url}/`),
    user
})), effect_1.Option.map(effect_1.Effect.succeed), effect_1.Option.getOrElse(() => effect_1.Effect.fail(Error('Could not parse URL.'))));
const COUCH_URL = effect_1.Config
    .redacted('COUCH_URL')
    .pipe(effect_1.Config.withDescription('The URL of the CouchDB server.'), effect_1.Config.option);
const createEnvironmentService = effect_1.Ref
    .make({
    url: effect_1.Redacted.make(effect_1.String.empty),
    user: effect_1.String.empty,
})
    .pipe(effect_1.Effect.map(env => ({
    get: () => effect_1.Ref.get(env),
    setUrl: (url) => parseCouchUrl(url)
        .pipe(effect_1.Effect.flatMap(newEnv => effect_1.Ref.setAndGet(env, newEnv))),
})), effect_1.Effect.tap((envService) => COUCH_URL.pipe(effect_1.Config.map(effect_1.Option.map(envService.setUrl)), effect_1.Config.map(effect_1.Option.map(effect_1.Effect.asVoid)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Effect.void)))));
class EnvironmentService extends effect_1.Effect.Service()('chtoolbox/EnvironmentService', { effect: createEnvironmentService, accessors: true, }) {
}
exports.EnvironmentService = EnvironmentService;
//# sourceMappingURL=environment.js.map