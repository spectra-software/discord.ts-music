import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
} from "@discordjs/voice";
import ytdl from "ytdl-core";
import ytSearch from "yt-search";

export class MusicPlayer {
  private queue: string[];
  public connection: any;
  private player: any;
  private volume: number;
  private currentTrack: string;
  private loop: boolean;
  private startTime: number;
  private elapsedTime: number;

  constructor() {
    this.queue = [];
    this.connection = null;
    this.player = createAudioPlayer();
    this.volume = 50;
    this.currentTrack = "";
    this.loop = false;
    this.startTime = 0;
    this.elapsedTime = 0;

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.queue.length > 0) {
        const nextTrack = this.queue.shift();
        this.play(nextTrack);
      }
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      this.startTime = Date.now();
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this.elapsedTime += Date.now() - this.startTime;
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.elapsedTime = 0;
    });
  }

  public async join(message: any) {
    const voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
      this.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });
    } else {
      return;
    }
  }

  public async leave(message: any) {
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  public play(url: string) {
    const stream = ytdl(url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25, // 32MB
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });

    resource.playStream.on("end", () => {
      if (this.loop) {
        this.play(url);
      } else {
        if (this.queue.length > 0) {
          const nextTrack = this.queue.shift();
          this.play(nextTrack);
        } else {
          this.stop();
        }
      }
    });

    if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.subscribe(this.player);
      this.player.play(resource);
      this.currentTrack = url;
    } else {
      throw new Error("Nie jesteś połączony z kanałem głosowym.");
    }
  }

  public pause() {
    this.player.pause();
  }

  public resume() {
    this.player.unpause();
  }

  public stop() {
    this.player.stop();
    this.queue = [];
    this.currentTrack = null;
  }

  public setVolume(volume: number) {
    if (volume >= 0 && volume <= 100) {
      this.volume = volume;
      if (this.connection && this.player) {
        const volumeLevel = volume / 100;
        this.player.setVolume(volumeLevel);
      }
    } else {
      throw new Error("Głośność musi być wartością między 0 a 100.");
    }
  }

  public async search(query: string) {
    const searchResults = await ytSearch(query);
    return searchResults.videos.length > 0 ? searchResults.videos[0].url : "";
  }

  public nowPlaying(message: any) {
    if (this.currentTrack !== "") {
      message.reply(`Aktualnie odtwarzany utwór: ${this.currentTrack}`);
    } else {
      message.reply("Obecnie nie odtwarzam żadnego utworu.");
    }
  }

  public addToQueue(url: string) {
    this.queue.push(url);
  }

  public toggleLoop() {
    this.loop = !this.loop;
  }

  public getQueue() {
    return this.queue;
  }

  public getCurrentTrack() {
    return this.currentTrack;
  }

  public async Thumbnail(url: string) {
    if (url) {
      const info = await ytdl.getInfo(url);
      const thumbnail = info.videoDetails.thumbnails[0];
      const thumbnailUrl = thumbnail.url;
      return thumbnailUrl;
    } else {
      throw new Error("[MusicPlayer] no url provided - Thumbnail");
    }
  }

  public async Title(url: string) {
    if (url) {
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title;
      return title;
    } else {
      throw new Error("[MusicPlayer] no url provided - Title");
    }
  }

  public async Author(url: string) {
    if (url) {
      const info = await ytdl.getInfo(url);
      const author = info.videoDetails.author.name;
      return author;
    } else {
      throw new Error("[MusicPlayer] no url provided - Author");
    }
  }

  public async getTimeRemaining(url: string): Promise<number | null> {
    if (url) {
      const info = await ytdl.getInfo(url);
      const duration = parseInt(info.videoDetails.lengthSeconds);
      return duration;
    } else {
      throw new Error("[MusicPlayer] no url provided - GetTimeRemaining");
    }
  }

  public async getTimeElapsed(): Promise<number | null> {
    const playerState = this.player.state;
    if (playerState.status === AudioPlayerStatus.Playing) {
      const elapsedTime = this.elapsedTime + (Date.now() - this.startTime);
      return elapsedTime;
    }
    return null;
  }

  public async formatDuration(durationInSeconds: number) {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);

    const formattedHours = hours.toString().padStart(2, "0");
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const formattedSeconds = seconds.toString().padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }
}
