import { DashBuffer } from './DashBuffer'
import { DashSegments } from './DashSegments'
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

  private videoSegments: DashSegments | undefined
  private audioSegments: DashSegments | undefined

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

    this.videoSegments = new DashSegments(this.manifest.playlists[0].segments)

    const videoCodecs = `video/mp4; codecs="${this.manifest.playlists[0].attributes.CODECS}"`
    this.videoBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(videoCodecs),
      this.videoSegments
    )

    await this.videoBuffer.init()

    const audioPlaylist = this.manifest.mediaGroups.AUDIO.audio.main.playlists[0]
    const audioCodecs = `audio/mp4; codecs="${audioPlaylist.attributes.CODECS}"`

    this.audioSegments = new DashSegments(audioPlaylist.segments)

    this.audioBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(audioCodecs),
      this.audioSegments
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
      this.updateIntervalId = setInterval(() => {
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
