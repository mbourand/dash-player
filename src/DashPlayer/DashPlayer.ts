import { DashBuffer } from './DashBuffer'
import { DashPlaylistController } from './DashPlaylistController'
import { parse } from 'mpd-parser'

export class DashPlayer {
  private videoElement: HTMLVideoElement | undefined
  private manifest: any | undefined
  private baseURL: string | undefined

  private updateIntervalId: number | undefined
  private updateIntervalTimeout: number = 1000 / 8
  private mediaSource: MediaSource | undefined

  private videoBuffer: DashBuffer | undefined
  private audioBuffer: DashBuffer | undefined

  constructor() {
    this.videoElement = undefined
  }

  public attachTo(element: HTMLVideoElement) {
    this.videoElement = element
  }

  private async _fetchManifest(manifestUrl: string) {
    const response = await fetch(manifestUrl)
    const text = await response.text()
    return parse(text, { manifestUri: manifestUrl })
  }

  private async _onSourceOpen() {
    if (!this.mediaSource || !this.manifest || !this.baseURL || !this.videoElement) {
      throw new Error('No media source, manifest, base URL or video element')
    }

    this.mediaSource.duration = this.manifest.duration

    const videoCodecs = `video/mp4; codecs="${this.manifest.playlists[0].attributes.CODECS}"`
    this.videoBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(videoCodecs),
      new DashPlaylistController(this.manifest.playlists, 0)
    )

    await this.videoBuffer.init()

    const audioPlaylists = this.manifest.mediaGroups.AUDIO.audio.main.playlists
    const audioCodecs = `audio/mp4; codecs="${audioPlaylists[0].attributes.CODECS}"`

    this.audioBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(audioCodecs),
      new DashPlaylistController(audioPlaylists, 0)
    )

    await this.audioBuffer.init()
  }

  public async load(manifestUrl: string) {
    if (!this.videoElement) {
      throw new Error('No video element attached to the player')
    }

    const asURL = new URL(manifestUrl)
    this.baseURL = asURL.origin + asURL.pathname.split('/').slice(0, -1).join('/')

    this.manifest = await this._fetchManifest(manifestUrl)

    this.mediaSource = new MediaSource()
    this.videoElement.src = URL.createObjectURL(this.mediaSource)
    this.mediaSource.addEventListener('sourceopen', this._onSourceOpen.bind(this))

    this.videoElement.addEventListener('pause', () => {
      clearInterval(this.updateIntervalId)
      this.updateIntervalId = undefined
    })

    this.videoElement.addEventListener('play', () => {
      this.updateIntervalId = window.setInterval(() => {
        this.videoBuffer?.updateBuffer()
        this.audioBuffer?.updateBuffer()
      }, this.updateIntervalTimeout)
    })

    this.videoElement.addEventListener('seeking', () => {
      if (!this.videoElement) {
        return
      }

      this.videoBuffer?.seek(this.videoElement.currentTime)
      this.audioBuffer?.seek(this.videoElement.currentTime)
    })
  }
}
