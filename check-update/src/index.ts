const jsonFetch = async (url: string) => (await (await fetch(url)).json())

const env = Deno.env;
const vblogRepo = env.get("VUE_BLOG_REPOSITORY")
const siteRepo = env.get("GITHUB_REPOSITORY")

async function timeCompare(){
    var vblog = await jsonFetch(`https://api.github.com/repos/${vblogRepo}/branches/master`)
    var site = await jsonFetch(`https://api.github.com/repos/${siteRepo}/branches/master`)
    const toCommitTime = (body: any) => new Date(body.commit.commit.committer.date)
    const update = toCommitTime(vblog) > toCommitTime(site)
    console.log("Update-check:"+update)
    Deno.run({
        cmd: ["echo",`::set-output name=should-update::${update}`]
    })
}

timeCompare()