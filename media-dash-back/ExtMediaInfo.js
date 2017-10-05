const request = require("request-promise-native");
const MEDIA_TYPE = require("./MediaType");

const apiKey = "4156b1880c7c62c4a5391c5613c096a9";
const serviceUrl = "https://api.themoviedb.org/3";


const doGetInfoRequest = async (self, imdbId, mediaType) => {
    const response = JSON.parse(await request(`${serviceUrl}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`));
    const mediaInfo = response[mediaType === MEDIA_TYPE.TV ? "tv_results" : "movie_results"][0];
    return {
        title: mediaInfo[mediaType === MEDIA_TYPE.TV ? "name" : "title"],
        posterPath: mediaInfo["poster_path"],
        backdropPath: mediaInfo["backdrop_path"],
        overview: mediaInfo["overview"],
        releaseDate: mediaInfo[mediaType === MEDIA_TYPE.TV ? "first_air_date" : "release_date"],
        voteScore: mediaInfo["vote_average"],
        genreIds: mediaInfo["genre_ids"]
    };
};

const getMovieImdbId = async (name) => {
    try {
        const searchResult = await searchMovie(name);
        var tmdbId = searchResult.results[0].id;
        const movieInfo = await getMovieInfo(tmdbId);
        return movieInfo.imdb_id;
    } catch (e) {
        console.log(`Error code received for ${name}: ${e}`);
        return null;
    }
};

const searchMovie = async (name) => {
    const searchMovieUrl = `${serviceUrl}/search/movie?api_key=${apiKey}`;
    const movie = separateMovieNameAndYear(name);
    const reqUrl = `${searchMovieUrl}&query=${encodeURIComponent(movie.name)}&year=${movie.year}`;
    return JSON.parse(await request(reqUrl));
};

const getMovieInfo = async (tmdbId) => {
    return JSON.parse(await request(`${serviceUrl}/movie/${tmdbId}?api_key=${apiKey}`));
};

const separateMovieNameAndYear = (name) => {
    return { name: name.slice(0, name.length - 7), year: name.slice(-5, -1) };
};

const getTVShowImdbId = async (name) => {
    const searchResult = await searchTVShow(name);
    if (searchResult.results.length === 0) return null;
    var tmdbId = searchResult.results[0].id;
    const info = await getTVShowInfo(tmdbId);
    return info.imdb_id;
};

const searchTVShow = async (name) => {
    const reqUrl = `${serviceUrl}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(name)}`;
    return JSON.parse(await request(reqUrl));
};

const getTVShowInfo = async (tmdbId) => {
    return JSON.parse(await request(`${serviceUrl}/tv/${tmdbId}/external_ids?api_key=${apiKey}`));
};

module.exports = class ExtMediaInfo {
    constructor(ct) {
        ct.extMediaInfo = this;
        this.ct = ct;
    }
    async getImdbId(title, mediaType) {
        try {
            return mediaType === MEDIA_TYPE.MOVIE ? getMovieImdbId(title) : getTVShowImdbId(title);
        } catch (e) {
            console.log(`Error code received for ${title}: ${e}`);
            return null;
        }
    }
    async getInfo(imdbId, mediaType) {
        return this.ct.cache.readOrLoadCacheValue(
            "ext-media-info.json",
            `${imdbId}___${mediaType}`,
            async () => await doGetInfoRequest(this, imdbId, mediaType));
    }
    async _loadImdbIds() {
        this.imdbIds = await this.ct.cache.readOrLoadCache(
            this.imdbIdsCacheKey,
            () => ({ [MEDIA_TYPE.MOVIE]: {}, [MEDIA_TYPE.TV]: {} }));
    }
};