import { Config, Effect, Option, Redacted, Ref, String, Array, Predicate } from 'effect';
const COUCH_URL_PATTERN = /^(https?:\/\/([^:]+):[^/]+).*$/;
const parseCouchUrl = (url) => url.pipe(Redacted.value, String.match(COUCH_URL_PATTERN), Option.map(([, url, user]) => [url, user]), Option.filter((data) => Array.every(data, Predicate.isNotNullable)), Option.map(([url, user]) => ({
    url: Redacted.make(`${url}/`),
    user
})), Option.map(Effect.succeed), Option.getOrElse(() => Effect.fail(Error('Could not parse URL.'))));
const COUCH_URL = Config
    .redacted('COUCH_URL')
    .pipe(Config.withDescription('The URL of the CouchDB server.'), Config.option);
const createEnvironmentService = Ref
    .make({
    url: Redacted.make(String.empty),
    user: String.empty,
})
    .pipe(Effect.map(env => ({
    get: () => Ref.get(env),
    setUrl: (url) => parseCouchUrl(url)
        .pipe(Effect.flatMap(newEnv => Ref.setAndGet(env, newEnv))),
})), Effect.tap((envService) => COUCH_URL.pipe(Config.map(Option.map(envService.setUrl)), Config.map(Option.map(Effect.asVoid)), Effect.flatMap(Option.getOrElse(() => Effect.void)))));
export class EnvironmentService extends Effect.Service()('chtoolbox/EnvironmentService', { effect: createEnvironmentService, accessors: true, }) {
}
