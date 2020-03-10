export interface ReleaseInfo {
    tree: dirObj
    manifest: {
        [path: string]: {
            lastEditDate: string
            size: number
        }
    }
}

export type dirObj = {
    path: string;
    file: Array<dirItem>;
}


export type dirItem = string | dirObj