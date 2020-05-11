import { GitKit, toFilePathArray, grepForPath } from "./githubapi.ts"
import { ReleaseInfo } from "./type.ts"
const env = Deno.env;
const token = env.get("GITHUB_TOKEN") ?? ""
const [owner, repo] = env.get("GITHUB_REPOSITORY")!.split("/")

async function writeToMapJson() {
  var gitkit = new GitKit({ owner, repo, token })
  let tree = await gitkit.tree()
  const manifest: any = {}
  // Remove folder name starts with dot
  tree = grepForPath(tree,it=>!(it.startsWith("/.")))
  for (const it of toFilePathArray(tree)) {
    const size = await gitkit.getFileSize(it)
    const lastEditDate = await gitkit.getLastEditDate(it)
    manifest[it] = {
      lastEditDate,
      size,
    }
  }
  const info: ReleaseInfo = {
    tree,
    manifest
  }
  console.log(info)
  const str = JSON.stringify(info)
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  await Deno.writeFile("map.json", data);
}

writeToMapJson()
