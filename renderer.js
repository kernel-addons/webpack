import commonModules from "./common.js";
import "./polyfills.js";

/**
 * Discord's webpack cache global name.
 */
const CHUNK_NAME = "webpackChunkdiscord_app";

/**
 * Discord's __webpack_require__ instance.
 */
let __webpack_require__ = null;

/**
 * Bool if the webpack cache is initialized.
 */
let ready = false;

/**
 * Events for the webpack module. Available events:
 * `ready` | `push`
 */
const Events = new EventTarget();

/**
 * Promise for when discord's webpack cache is fully initialized and ready to use.
 */
const whenReady = new Promise(resolve => {
    Events.addEventListener("ready", () => {
        resolve();
        ready = true;
    }, {once: true});
});

/**
 * Promise for when discord's global was found.
 */
const globalPromise = new Promise(async onExists => {
    while (!Array.isArray(window[CHUNK_NAME])) {
        await new Promise(setImmediate);
    }

    onExists();
});

const Filters = {
    byProps(...props) {
        const types = ["number", "string"];

        return (m) => m && !~types.indexOf(typeof m) && props.every(prop => prop in m);
    },
    byDisplayName(displayName, defaultExports = false) {
        return defaultExports
            ? (m) => m?.default?.displayName === displayName
            : (m) => m?.displayName === displayName;
    },
    byPrototypes(...protos) {
        return (m) => typeof m === "function" && protos.every(p => p in m.prototype);
    },
    byFunctionStrings(...strings) {
        return (m) => typeof m?.default === "function" &&
            strings.every(string => ~m.default.toString().indexOf(string));
    }
};

/**
 * Grabs discord's __webpack_require__ including the cache.
 * @returns {any}
 */
const require = function () {
    if (__webpack_require__) return __webpack_require__;

    const chunk = [[Symbol("webpack")], {}, _ => _];
    __webpack_require__ = window[CHUNK_NAME].push(chunk);
    window[CHUNK_NAME].splice(window[CHUNK_NAME].indexOf(chunk), 1);

    return __webpack_require__;
};

/**
 * Finds modules inside the webpack cache.
 * @param {(module: any, id: number) => boolean} filter Filter function that validates modules.
 * @param {{
 *  all: boolean,
 *  force: boolean,
 *  default: boolean
 * }} options
 * @returns 
 */
const findModule = function (filter, {all = false, force = false, default: defaultExports = true} = {}) {
    if (typeof (filter) !== "function") return void 0;

    const __webpack_require__ = require();
    const found = [];
    let hasError = null;

    if (!__webpack_require__) return;

    const wrapFilter = function (module, index) {
        try {return filter(module, index);}
        catch (error) {
            hasError ??= error;
            return false;
        }
    };

    for (const id in __webpack_require__.c) {
        const module = __webpack_require__.c[id].exports;
        if (!module || module === window) continue;

        switch (typeof module) {
            case "object": {
                if (wrapFilter(module, id)) {
                    if (!all) return module;
                    found.push(module);
                }

                if (module.__esModule &&
                    module.default != null &&
                    typeof module.default !== "number" &&
                    wrapFilter(module.default, id)
                ) {
                    const exports = defaultExports ? module.default : module;
                    if (!all) return exports;
                    found.push(exports);
                }

                if (force && module.__esModule) for (const key in module) {
                    if (!module[key]) continue;

                    if (wrapFilter(module[key], id)) {
                        if (!all) return module[key];
                        found.push(module[key]);
                    }
                }

                break;
            }

            case "function": {
                if (wrapFilter(module, id)) {
                    if (!all) return module;
                    found.push(module);
                }

                break;
            }
        }
    }

    if (hasError) {
        console.warn("[Webpack] filter threw an error. This can cause lag spikes at the user's end. Please fix asap.\n", hasError);
    }

    return all ? found : found[0];
};

/**
 * Alias for findModule.
 * @param {(module: any, id: number) => boolean} filter Filter function that validates modules.
 * @param {} options 
 * @returns 
 */
const findModules = function (filter, options) {
    return findModule(filter, Object.assign({}, options, {all: true}));
};

/**
 * Waits for modules. 
 * @param {(module: any, id: number) => boolean} filter Filter function that validates modules. 
 * @param {{
 *  all: boolean,
 *  force: boolean,
 *  default: boolean
 * }} options
 * @returns {Promise<any>}
 */
const waitFor = async function (filter, {retries = 100, all = false, forever = false, delay = 50} = {}) {
    for (let i = 0; (i < retries) || forever; i++) {
        const module = findModule(filter, {all});
        if (module) return module;
        await new Promise(res => setTimeout(res, delay));
    }
};

/**
 * Bulk fetches modules from Webpack. This is a faster way of fetching multiple modules at once.
 * Valid options: {wait: boolean, wrap: boolean}
 * @param {...any} options Filters & options for the module searcher.
 * @returns {any[] | Promise<any>[]} 
 */
const bulk = function (...options) {
    const [filters, {wait = false, wrap = false, ...rest}] = parseOptions(options);
    const found = new Array(filters.length);
    const searchFunction = wait ? waitFor : findModule;
    const wrappedFilters = wrap ? filters.map(filter => {
        if (Array.isArray(filter)) filter = Filters.byProps(...filter);
        if (typeof (filter) === "string") filter = Filters.byDisplayName(filter);

        return (m) => {
            try {return filter(m);}
            catch (error) {return false;}
        };
    }) : filters;

    const returnValue = searchFunction((module) => {
        for (let i = 0; i < wrappedFilters.length; i++) {
            const filter = wrappedFilters[i];
            if (typeof filter !== "function" || !filter(module) || found[i] != null) continue;

            found[i] = module;
        }

        return found.filter(Boolean).length === filters.length;
    }, rest);

    if (wait) return returnValue.then(() => found);

    return found;
};

/**
 * Finds modules by props.
 * @returns {any | Promise<any>}
 */
const findByProps = function (...options) {
    const [props, {bulk: findBulk = false, wait = false, ...rest}] = parseOptions(options);

    if (!findBulk && !wait) {
        return findModule(Filters.byProps(...props), rest);
    }

    if (wait && !findBulk) {
        return waitFor(Filters.byProps(...props), rest);
    }

    if (findBulk) {
        const filters = props.map((actualProps) => Array.isArray(actualProps)
            ? Filters.byProps(...actualProps)
            : Filters.byProps(actualProps)
        );

        filters.push({wait, ...rest});

        return bulk(...filters);
    }


    return null;
};

/**
 * Finds modules by displayName.
 * @returns {any | Promise<any>}
 */
const findByDisplayName = function (...options) {
    const [displayNames, {bulk: findBulk = false, wait = false, ...rest}] = parseOptions(options);

    if (!findBulk && !wait) {
        return findModule(Filters.byDisplayName(displayNames[0], rest.default), rest);
    }

    if (wait && !findBulk) {
        return waitFor(Filters.byDisplayName(displayNames[0]), rest);
    }

    if (findBulk) {
        const filters = displayNames.map(Filters.byDisplayName);
        filters.push({wait, ...rest});

        return bulk(...filters);
    }

    return null;
};

/**
 * Finds the index of a module inside webpack cache.
 * @param {(module: any) => boolean} filter Filter to validate modules.
 * @returns {number}
 */
const findIndex = function (filter) {
    let foundIndex = -1;

    findModule((module, index) => {
        if (filter(module)) foundIndex = index;
    });

    return foundIndex;
};

/**
 * Gets the exports of a module at a specific index.
 * @param {number} index Index inside the webpack cache.
 * @returns {any}
 */
const atIndex = function (index) {
    return require()?.c[index];
};

/**
 * Parses arguments and finds the options.
 * @param {any[]} args A list of arguments. 
 * @param {(module: any) => boolean} filter filter that validates that options exist in the args tree.
 * @returns {any[]}
 */
const parseOptions = function (args, filter = thing => (typeof (thing) === "object" && thing != null && !Array.isArray(thing))) {
    return [args, filter(args.at(-1)) ? args.pop() : {}];
};

{
    const InitializeEvents = ["START_SESSION", "CONNECTION_OPEN"];
    (async () => {
        await globalPromise;
        const Dispatcher = await findByProps("dispatch", "isDispatching", {wait: true, forever: true});
        for (const event of InitializeEvents) {
            const listener = function () {
                Dispatcher.unsubscribe(event, listener);
                Events.dispatchEvent(new Event("ready"));
            };

            Dispatcher.subscribe(event, listener);
        }
    })();
}

export const Webpack = window.Webpack = {
    findModule,
    findByDisplayName,
    findByProps,
    findIndex,
    waitFor,
    bulk,
    Events,
    whenReady,
    require,
    atIndex,
    findModules,
    Filters,
    globalPromise,
    // Aliases
    getByProps: findByProps,
    getByDisplayName: findByDisplayName,
    getModule: findModule,
    getModules: findModules,
    getByIndex: atIndex,
    getIndex: findIndex,
    get ready() {return ready;},
    get common() {return commonCache;}
};
const descriptors = Object.getOwnPropertyDescriptors(commonModules);
const commonCache = {};

for (const name in descriptors) {
    const descriptor = descriptors[name];
    const originalGet = descriptor.get;
    if (typeof originalGet !== "function") continue;

    descriptor.get = () => {
        const result = originalGet();
        Object.defineProperty(commonCache, name, {
            value: result,
            enumerable: true,
            writable: true,
            configurable: true
        });

        return result;
    };

    Object.defineProperty(commonCache, name, descriptor);
}
