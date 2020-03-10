import { GitKit, toFilePathArray, grepForPath } from "./githubapi.ts"
import { ReleaseInfo } from "./type.ts"
const env = Deno.env();
const token = env.GITHUB_TOKEN
const [owner, repo] = env.GITHUB_REPOSITORY.split("/")

async function writeToMapJson() {
  var gitkit = new GitKit({ owner, repo, token })
  let tree = await gitkit.tree()
  const manifest: any = {}
  // Remove folder name starts with dot
  tree = grepForPath(tree,it=>!(it.startsWith("/.")))
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
