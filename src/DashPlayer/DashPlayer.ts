import { DashBuffer } from './DashBuffer'
import { DashManifest } from './DashManifest'
import { DashSegmentFetcher, SegmentTemplateType } from './DashSegmentFetcher'
import { EventType } from './EventManager'
import { iso8601 } from './iso8601-duration'

type MPDType = {
  mediaPresentationDuration: string
  minBufferTime: string
  profiles: string
  type: string
}

export class DashPlayer {
  private videoElement: HTMLVideoElement | undefined
  private manifest: any | undefined
  private baseURL: string | undefined

  private updateIntervalId: number | undefined
  private updateIntervalTimeout: number = 1000 / 8
  private mediaSource: MediaSource | undefined

  private videoBuffer: DashBuffer | undefined
  private audioBuffer: DashBuffer | undefined

  private videoSegmentFetcher: DashSegmentFetcher | undefined
  private audioSegmentFetcher: DashSegmentFetcher | undefined

  constructor() {
    this.videoElement = undefined
  }

  public attachTo(element: HTMLVideoElement) {
    this.videoElement = element
  }

  private async _fetchManifest(manifestUrl: string) {
    const response = await fetch(manifestUrl)
    const text = await response.text()
    return DashManifest.fromXML(text)
  }

  private async _onSourceOpen() {
    if (!this.mediaSource || !this.manifest || !this.baseURL || !this.videoElement) {
      throw new Error('No media source, manifest, base URL or video element')
    }

    const adaptationSet = this.manifest?.MPD.Period.AdaptationSet[0]
    const mpd: MPDType = this.manifest?.MPD._attributes
    const representation = adaptationSet.Representation[0]
    const segmentTemplate: SegmentTemplateType = adaptationSet.SegmentTemplate._attributes
    const videoMime = representation._attributes.mimeType ?? adaptationSet._attributes.mimeType
    const videoCodecs = representation._attributes.codecs ?? adaptationSet._attributes.codecs

    this.mediaSource.addEventListener('sourceended', (e) => {
      console.log(e.target)
    })

    this.mediaSource.duration = iso8601.parseDuration(mpd.mediaPresentationDuration)

    this.videoSegmentFetcher = new DashSegmentFetcher(segmentTemplate, representation._attributes.id, this.baseURL)

    const mimeCodec = `${videoMime}; codecs="${videoCodecs}"`
    this.videoBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(mimeCodec),
      this.videoSegmentFetcher
    )

    this.videoBuffer.setStartSegmentNumber(parseInt(segmentTemplate.startNumber, 10))

    await this.videoBuffer.init()

    const audioMime = this.manifest?.MPD.Period.AdaptationSet[1]._attributes.mimeType
    const audioCodecs = this.manifest?.MPD.Period.AdaptationSet[1].Representation._attributes.codecs
    const audioMimeCodecs = `${audioMime}; codecs="${audioCodecs}"`

    this.audioSegmentFetcher = new DashSegmentFetcher(
      this.manifest?.MPD.Period.AdaptationSet[1].SegmentTemplate._attributes,
      this.manifest?.MPD.Period.AdaptationSet[1].Representation._attributes.id,
      this.baseURL
    )

    this.audioBuffer = new DashBuffer(
      this.videoElement,
      this.mediaSource.addSourceBuffer(audioMimeCodecs),
      this.audioSegmentFetcher
    )

    this.audioBuffer.setStartSegmentNumber(
      parseInt(this.manifest?.MPD.Period.AdaptationSet[1].SegmentTemplate._attributes.startNumber, 10)
    )

    await this.audioBuffer.init()

    this.videoBuffer.addEventListener(EventType.BufferReachedEnd, () => {
      if (this.mediaSource?.readyState === 'open' && this.audioBuffer?.hasBufferReachedEnd()) {
        this.mediaSource?.endOfStream()
      }
    })

    this.audioBuffer.addEventListener(EventType.BufferReachedEnd, () => {
      if (this.mediaSource?.readyState === 'open' && this.videoBuffer?.hasBufferReachedEnd()) {
        this.mediaSource?.endOfStream()
      }
    })
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
