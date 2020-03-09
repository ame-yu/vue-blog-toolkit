export type dirObj = {
    path: string;
    file: Array<dirItem>;
}
type dirItem = string | dirObj

type gitStruct = {
    type: string;
    name: string;
}
type grepArg = RegExp | ((arg: dirItem) => boolean)

interface GitAuth {
    owner: string
    repo: string
    token: string
}
class GitKit {
    private owner: string
    private repo: string
    private token: string
    constructor(git: GitAuth) {
        this.owner = git.owner
        this.repo = git.repo
        this.token = git.token
    }

    sendQuery(content: string) {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
                query: `{repository(name: "${this.repo}", owner: "${
                    this.owner
                    }") {${content}}}`
            })
        };
        return fetch('https://api.github.com/graphql', options)
    }

    /**
    * grep file or folder
    * @param src The value to recursively clone.
    * @param decide Regex for all string or define your own filter function
    * @return Returns the dirObj after filter
    */
    grep(src: dirObj, decide: grepArg): dirObj {
        const file: Array<dirItem> = [];
        src.file.forEach((it: dirItem) => {
            if (typeof decide === 'function') {//Custom define
                if (typeof it === "object" && (it as dirObj).file) {
                    file.push(this.grep(it, decide));
                } else {
                    if (decide(it)) file.push(it)
                }
            } else {
                if (typeof it === 'string') {
                    if (decide.test(it)) file.push(it);
                } else {
                    file.push(this.grep(it, decide));
                }
            }
        });
        return {
            ...src,
            file
        };
    }


    grepFolder(src: dirObj): dirObj {
        const filterFuc = (it: dirItem) => (
            typeof it === "object" && (it as dirObj).path !== undefined
        )
        return this.grep(src, filterFuc)
    }


    /**
    * @param path
    * @return object tree
    {file:["xxx.mp3","xxx.mp4",{file:[...],path:XX}],path:XX}
    */
    async tree(path = "master:"): Promise<dirObj> {
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
        const parsed = await rsp.json()
        const dir = parsed.data.repository.dir
        const li = dir.entries.map(async (it: gitStruct) => {
            if (it.type === "tree") {
                //object
                const childPath =
                    path === "master:" ? `${path}${it.name}` : `${path}/${it.name}`;
                return await this.tree(childPath);
            } else {
                return it.name;
            }
        });

        return {
            path,
            file: await Promise.all(li)
        };
    }
}


function toFolderPathArray(src: dirObj): Array<string> {
    const array: Array<string> = [];
    array.push(src.path.replace("master:", "/"))
    src.file.forEach((it: dirItem) => {
        if (typeof it === "object") {
            array.push(...toFolderPathArray(it))
        }
    });
    return array
}

function shortName(path: string) {
    return path.replace("master:", "").split("/").slice(-1)[0]
}

/**
* get the manifest of the resource
* @param src:dirObj
* @return Array<string>
*/

function toFilePathArray(src: dirObj): Array<string> {
    const array: Array<string> = [];
    const parentPath = src.path.replace("master:", "/")
    src.file.forEach((it: dirItem) => {
        if (typeof it === "object") {
            array.push(...toFilePathArray(it))
        } else {
            const delimiter = parentPath === "/" ? "" : "/"
            array.push(`${parentPath}${delimiter}${it}`)
        }
    });
    return array
}

export { GitKit, toFilePathArray }