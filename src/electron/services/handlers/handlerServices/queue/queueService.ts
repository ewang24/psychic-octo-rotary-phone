import { Album } from "../../../../../core/db/dbEntities/album";
import { Artist } from "../../../../../core/db/dbEntities/artist";
import { Song, SongWithAlbum } from "../../../../../core/db/dbEntities/song";
import { SongsWithCurrentlyPlaying } from "../../../../../core/db/dbEntities/songWithCurrentlyPlaying";
import { AlbumDto } from "../../../../../core/db/dto/albumDto";
import { ArtistDto } from "../../../../../core/db/dto/artistDto";
import { Connector } from "../../../../../core/db/dto/connector";
import { QueueDto } from "../../../../../core/db/dto/queueDto";
import { SongDto } from "../../../../../core/db/dto/songDto";
import { SystemDto } from "../../../../../core/db/dto/systemDto";
import { handler } from "../../decorators/handlerDecorator";
const fs = require('fs');

export class QueueService{
    queueDto: QueueDto;
    systemDto: SystemDto;
    songDto: SongDto;
    artistDto: ArtistDto;
    albumDto: AlbumDto;

    constructor(connector: Connector){
        this.queueDto = new QueueDto(connector);
        this.systemDto = new SystemDto(connector);
        this.songDto = new SongDto(connector);
        this.artistDto = new ArtistDto(connector);
        this.albumDto = new AlbumDto(connector);
    }

    @handler
    async playSong(songId: number){
        await this.queueDto.clearQueue();
        return this.queueDto.queueSong(songId, true);
    }

    @handler
    async queueSong(songId: number): Promise<void>{
        //TODO account for shuffled queue in this function.
        const queueSize = await this.queueDto.getQueueSize();
        return this.queueDto.queueSong(songId, queueSize === 0);
    }

    @handler
    async getNextSongInQueue(): Promise<Song>{
        const [shuffled, repeat] = await Promise.all([this.systemDto.isShuffled(), this.systemDto.isRepeat()]);
        return this.queueDto.getNextSongInQueue(shuffled, repeat);
    }

    @handler
    async getPreviousSongInQueue(): Promise<SongWithAlbum>{
        const [shuffled, repeat] = await Promise.all([this.systemDto.isShuffled(), this.systemDto.isRepeat()]);
        return this.queueDto.getPreviousSongInQueue(shuffled);
    }

    @handler
    async transitionCurrentSong(nextCurrentSongId: number): Promise<void>{
        return this.queueDto.setSongAsCurrent(nextCurrentSongId);
    }

    @handler
    async playAlbum(albumId: number): Promise<void>{
        await this.queueDto.clearQueue();
        await Promise.all([this.systemDto.setShuffled(false), this.queueAlbum(albumId, true)]);
    }

    @handler
    async queueAlbum(albumId: number, setCurrent?: boolean): Promise<void>{
        await Promise.all([this.systemDto.setShuffled(false), this.queueDto.queueAlbum(albumId, setCurrent)]);
    }

    @handler
    async playArtist(artistId: number): Promise<void>{
        await this.queueDto.clearQueue();
        await Promise.all([this.systemDto.setShuffled(false), this.queueArtist(artistId, true)]);
    }

    @handler
    async queueArtist(artistId: number, setCurrent?: boolean): Promise<void>{
        await Promise.all([this.systemDto.setShuffled(false), this.queueDto.queueArtist(artistId, setCurrent)]);       
    }

    @handler
    async queueAllSongsAndPlay(songId: number): Promise<void>{
        await Promise.all([this.systemDto.setShuffled(false), this.queueAllSongs()]);
        return this.queueDto.setSongAsCurrent(songId);
    }

    @handler
    async queueAllSongsAndPlayFirstSong(): Promise<SongWithAlbum>{
        await Promise.all([this.systemDto.setShuffled(false), this.queueAllSongs()]);
        await this.queueDto.setFirstSongInQueueCurrent();
        const currentQueueRecord = await this.queueDto.getCurrentSong();
        return this.songDto.getSong(currentQueueRecord.songId);
    }

    @handler
    async queueAllSongs(): Promise<void>{
        await Promise.all([this.systemDto.setShuffled(false), this.queueDto.queueAllSongs()]);
    }

    @handler
    async shuffleCurrentQueue(): Promise<void>{
        await this.systemDto.setShuffled(true);
        return this.queueDto.moveCurrentSongToShuffledQueueStart()
    }

    @handler
    async shuffleAllSongsAndPlay(): Promise<SongWithAlbum>{
        await Promise.all([this.queueDto.queueAllSongs(), this.systemDto.setShuffled(true)]);
        await this.queueDto.setFirstShuffledSongCurrent();
        const currentQueueRecord = await this.queueDto.getCurrentSong();
        return this.songDto.getSong(currentQueueRecord.songId);
    }

    @handler
    async getAllQueuedSongs(): Promise<SongsWithCurrentlyPlaying>{
        const shuffled = await this.systemDto.isShuffled();
        const currentQueue = await this.queueDto.getCurrentSong();
        const [currentlyPlaying, songs] = await Promise.all([this.songDto.getSong(currentQueue.songId), this.songDto.getSongsByQueue(shuffled)]);
        return {
            currentlyPlaying,
            songs
        }
    }

    @handler
    async playRandomAlbum(): Promise<SongWithAlbum>{
        const [album]: [Album, void, void] = await Promise.all([this.albumDto.getRandomAlbum(), this.queueDto.clearQueue(), this.systemDto.setShuffled(false)]);
        await this.queueDto.queueAlbum(album.id);
        await this.queueDto.setFirstSongInQueueCurrent();
        return this.queueDto.getFirstSong();
    }

    @handler
    async playRandomArtist(): Promise<SongWithAlbum>{
        const [artist]: [Artist, void, void] = await Promise.all([this.artistDto.getRandomArtist(), this.queueDto.clearQueue(), this.systemDto.setShuffled(false)]);
        await this.queueDto.queueArtist(artist.id);
        await this.queueDto.setFirstSongInQueueCurrent();
        return this.queueDto.getFirstSong();
    }
}