const { promisify } = require("util");
const Immutable = require("seamless-immutable");
const glob = promisify(require("glob"));
const MEDIA_TYPE = require("./MediaType");

const cacheFile = "file-listing.json";

module.exports = class FileListing {
    constructor(ct) {
        ct.fileListing = this;
        this.ct = ct;
    }
    async get() {
        return this.ct.cache.readOrCreateFile(
            cacheFile,
            async () => await scanForMediaFiles(this.ct.props.mediaDir));
    }

    getPath(mediaType, mediaName) {
        return `${this.ct.props.mediaDir}/${mediaType}/${mediaName}`;
    }

    async refresh(mediaType, mediaName) {
        await refresh(this, this.ct.props.mediaDir, mediaType, mediaName);
    }

};

const refresh = async (self, mediaDir, mediaType, mediaName) => {
    const files = await glob(
        `${mediaDir}/${mediaType}/${mediaName}/**/!(*.idx|*.jpg|*.smi|*.nfo)`,
        { nodir: true });
    const tree = toTree(files.map(s => s.substring(`${mediaDir}/${mediaType}`.length)));
    
    const cache = await self.ct.cache.readFile(cacheFile);
    cache[mediaType].children[mediaName] = tree[mediaName];
    self.ct.cache.persistFile(cacheFile, cache);
};

const scanForMediaFiles = async (mediaDir) => {
    console.log("FileListing INFO: Scanning file listing");
    const start = new Date();
    const files = await glob(
        `${mediaDir}/@(${MEDIA_TYPE.TV}|${MEDIA_TYPE.MOVIE})/**/!(*.idx|*.jpg|*.smi|*.nfo)`,
        { nodir: true });
    console.log(`FileListing INFO: Files scanned, ${files.length} files found in ${new Date() - start}ms`);
    return toTree(files.map(s => s.substring(mediaDir.length)));
};

const toTree = (fileList) => {
    const root = new Folder();
    fileList.forEach(file => toTreeRecursive(file, file.charAt(0) === "/" ? 1 : 0, root));
    return root.children;
};

const toTreeRecursive = (filePath, curIndex, parent) => {
    if (curIndex >= filePath.length) return;
    const idx = filePath.indexOf("/", curIndex);
    const token = filePath.substring(curIndex, idx === -1 ? filePath.length : idx);
    if (idx == -1) {
        parent.addFile(token);
        return;
    }
    const folder = parent.findOrCreateChild(token);
    toTreeRecursive(filePath, idx + 1, folder);
};

class Folder {
    constructor() {
        this.type = "FOLDER";
        this.children = {};
    }
    addFile(name) {
        this.children[name] = {};
    }
    findOrCreateChild(name) {
        let child = this.children[name];
        if (!child) {
            child = new Folder();
            this.children[name] = child;
        }
        return child;
    }
}