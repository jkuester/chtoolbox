"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalUpdate = void 0;
const effect_1 = require("effect");
const optionalUpdate = (ref, value) => value.pipe(effect_1.Option.map(value => effect_1.Ref.update(ref, () => value)), effect_1.Option.getOrElse(() => effect_1.Effect.void));
exports.optionalUpdate = optionalUpdate;
//# sourceMappingURL=core.js.map