// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// A script preamble that provides the ability to load a single outfile
// TypeScript "bundle" where a main module is loaded which recursively
// instantiates all the other modules in the bundle.  This code is used to load
// bundles when creating snapshots, but is also used when emitting bundles from
// Deno cli.

// @ts-nocheck

/**
 * @type {(name: string, deps: ReadonlyArray<string>, factory: (...deps: any[]) => void) => void=}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let define;

/**
 * @type {(mod: string) => any=}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let instantiate;

/**
 * @callback Factory
 * @argument {...any[]} args
 * @returns {object | void}
 */

/**
 * @typedef ModuleMetaData
 * @property {ReadonlyArray<string>} dependencies
 * @property {(Factory | object)=} factory
 * @property {object} exports
 */

(function() {
  /**
   * @type {Map<string, ModuleMetaData>}
   */
  const modules = new Map();

  /**
   * Bundles in theory can support "dynamic" imports, but for internal bundles
   * we can't go outside to fetch any modules that haven't been statically
   * defined.
   * @param {string[]} deps
   * @param {(...deps: any[]) => void} resolve
   * @param {(err: any) => void} reject
   */
  const require = (deps, resolve, reject) => {
    try {
      if (deps.length !== 1) {
        throw new TypeError("Expected only a single module specifier.");
      }
      if (!modules.has(deps[0])) {
        throw new RangeError(`Module "${deps[0]}" not defined.`);
      }
      resolve(getExports(deps[0]));
    } catch (e) {
      if (reject) {
        reject(e);
      } else {
        throw e;
      }
    }
  };

  define = (id, dependencies, factory) => {
    if (modules.has(id)) {
      throw new RangeError(`Module "${id}" has already been defined.`);
    }
    modules.set(id, {
      dependencies,
      factory,
      exports: {}
    });
  };

  /**
   * @param {string} id
   * @returns {any}
   */
  function getExports(id) {
    const module = modules.get(id);
    if (!module) {
      // because `$deno$/ts_global.d.ts` looks like a real script, it doesn't
      // get erased from output as an import, but it doesn't get defined, so
      // we don't have a cache for it, so because this is an internal bundle
      // we can just safely return an empty object literal.
      return {};
    }
    if (!module.factory) {
      return module.exports;
    } else if (module.factory) {
      const { factory, exports } = module;
      delete module.factory;
      if (typeof factory === "function") {
        const dependencies = module.dependencies.map(id => {
          if (id === "require") {
            return require;
          } else if (id === "exports") {
            return exports;
          }
          return getExports(id);
        });
        factory(...dependencies);
      } else {
        Object.assign(exports, factory);
      }
      return exports;
    }
  }

  instantiate = dep => {
    define = undefined;
    const result = getExports(dep);
    // clean up, or otherwise these end up in the runtime environment
    instantiate = undefined;
    return result;
  };
})();

define("type", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("githubapi", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GitKit {
        constructor(git) {
            this.owner = git.owner;
            this.repo = git.repo;
            this.token = git.token;
        }
        sendQuery(content) {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    query: `{repository(name: "${this.repo}", owner: "${this.owner}") {${content}}}`
                })
            };
            return fetch('https://api.github.com/graphql', options);
        }
        /**
        * @param path
        * @return object tree
        {file:["xxx.mp3","xxx.mp4",{file:[...],path:XX}],path:XX}
        */
        async tree(path = "master:") {
            const rsp = await this.sendQuery(`
              dir:object(expression: "${path}") {
                ... on Tree {
                  entries {
                    name
                    type
                  }
                }
              }
            `);
            const parsed = await rsp.json();
            const dir = parsed.data.repository.dir;
            const li = dir.entries.map(async (it) => {
                if (it.type === "tree") {
                    //object
                    const childPath = path === "master:" ? `${path}${it.name}` : `${path}/${it.name}`;
                    return await this.tree(childPath);
                }
                else {
                    return it.name;
                }
            });
            return {
                path: path.replace("master:", "/"),
                file: await Promise.all(li)
            };
        }
        async getFileSize(filename) {
            const path = filename.startsWith("/") ? `master:${filename.slice(1)}` : filename;
            const rsp = await this.sendQuery(`
            file: object(expression: "${path}") {
              ... on Blob {
                byteSize
              }
            }
            `);
            const parsed = await rsp.json();
            return parsed.data.repository.file.byteSize;
        }
        async getLastEditDate(filename) {
            const path = filename.startsWith("/") ? filename.slice(1) : filename;
            const rsp = await this.sendQuery(`
        ref(qualifiedName: "refs/heads/master") {
            target {
              ... on Commit {
                history(first: 1, path: "${path}") {
                  edges {
                    node {
                      committedDate
                    }
                  }
                }
              }
            }
          }
            `);
            const parsed = await rsp.json();
            console.log(parsed.data.repository.ref.target.history);
            return parsed.data.repository.ref.target.history.edges[0].node.committedDate;
        }
    }
    exports.GitKit = GitKit;
    function toFolderPathArray(src) {
        const array = [];
        array.push(src.path.replace("master:", "/"));
        src.file.forEach((it) => {
            if (typeof it === "object") {
                array.push(...toFolderPathArray(it));
            }
        });
        return array;
    }
    function shortName(path) {
        return path.replace("master:", "").split("/").slice(-1)[0];
    }
    /**
    * get the manifest of the resource
    * @param src:dirObj
    * @return Array<string>
    */
    /**
        * grep file or folder
        * @param src The value to recursively clone.
        * @param decide Regex for all string or define your own filter function
        * @return Returns the dirObj after filter
        */
    function grep(src, decide) {
        const file = [];
        src.file.forEach((it) => {
            if (typeof decide === 'function') { //Custom define
                if (typeof it === "object" && it.file) {
                    file.push(grep(it, decide));
                }
                else {
                    if (decide(it))
                        file.push(it);
                }
            }
            else {
                if (typeof it === 'string') {
                    if (decide.test(it))
                        file.push(it);
                }
                else {
                    file.push(grep(it, decide));
                }
            }
        });
        return {
            ...src,
            file
        };
    }
    exports.grep = grep;
    function grepForPath(src, decide) {
        const file = [];
        src.file.forEach((it) => {
            if (typeof it === "object" && it.file) {
                if (decide(it.path))
                    file.push(grepForPath(it, decide));
            }
            else {
                file.push(it);
            }
        });
        return {
            ...src,
            file
        };
    }
    exports.grepForPath = grepForPath;
    function grepFolder(src) {
        const filterFuc = (it) => (typeof it === "object" && it.path !== undefined);
        return grep(src, filterFuc);
    }
    function toFilePathArray(src) {
        const array = [];
        const parentPath = src.path.replace("master:", "/");
        src.file.forEach((it) => {
            if (typeof it === "object") {
                array.push(...toFilePathArray(it));
            }
            else {
                const delimiter = parentPath === "/" ? "" : "/";
                array.push(`${parentPath}${delimiter}${it}`);
            }
        });
        return array;
    }
    exports.toFilePathArray = toFilePathArray;
});
define("index", ["require", "exports", "githubapi"], function (require, exports, githubapi_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // const env = Deno.env();
    // const token = env.GITHUB_TOKEN
    // const [owner, repo] = env.GITHUB_REPOSITORY.split("/")
    const token = "e6f29cd8f69aebc3467ed514ddc363698bd51106";
    const [owner, repo] = ["ame-yu", "blog"];
    async function writeToMapJson() {
        var gitkit = new githubapi_ts_1.GitKit({ owner, repo, token });
        let tree = await gitkit.tree();
        const manifest = {};
        // Remove folder name starts with dot
        tree = githubapi_ts_1.grepForPath(tree, it => !(it.startsWith("/.")));
        for (const it of githubapi_ts_1.toFilePathArray(tree)) {
            const size = await gitkit.getFileSize(it);
            const lastEditDate = await gitkit.getLastEditDate(it);
            manifest[it] = {
                lastEditDate,
                size,
            };
        }
        const info = {
            tree,
            manifest
        };
        console.log(info);
        const str = JSON.stringify(info);
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        await Deno.writeFile("map.json", data);
    }
    writeToMapJson();
});

instantiate("index");
