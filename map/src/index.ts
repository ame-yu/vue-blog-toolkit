import { GitKit, toFilePathArray, dirObj } from "./githubapi.ts"

// const env = Deno.env();
// const token = env.GITHUB_TOKEN
// const [owner, repo] = env.GITHUB_REPOSITORY.split("/")



//WARNING Test only
const token = "03b86f3c5c2b110a97310d0c6ea92932f0ce71d3"
const [owner, repo] = ["ame-yu", "blog"]

interface ReleaseInfo {
  tree: dirObj
  manifest: {
    [path: string]: {
      lastEditDate: string
      size: number
    }
  }
}


async function writeToMapJson() {
  var gitkit = new GitKit({ owner, repo, token })
  const tree = await gitkit.tree()
  const manifest: any = {}

  toFilePathArray(tree).forEach(it => {
    manifest[it] = {
      lastEditDate: "2020-03-09T01:00:42.852Z",
      size: 0
    }
  })
  const info: ReleaseInfo = {
    tree,
    manifest
  }

  const str = JSON.stringify(info)
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  await Deno.writeFile("map.json", data);
}

writeToMapJson()
