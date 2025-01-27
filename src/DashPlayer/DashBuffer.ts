import { ABRController } from './ABRController'
import { DashPlaylistController } from './DashPlaylistController'
import { EventManager, EventType } from './EventManager'

export class DashBuffer {
  private sourceBuffer: SourceBuffer
  private segmentFetchDelay: number = 10
  private currentSegmentIndex: number = 0
  private videoElement: HTMLVideoElement
  private dashPlaylistController: DashPlaylistController

  private _isFetchingSegment: boolean = false

  private abrManager = new ABRController(3)
  private eventManager = new EventManager()

  private seekTo: number | undefined = undefined

  constructor(
    videoElement: HTMLVideoElement,
    sourceBuffer: SourceBuffer,
    dashPlaylistController: DashPlaylistController
  ) {
    this.sourceBuffer = sourceBuffer
    this.videoElement = videoElement
    this.dashPlaylistController = dashPlaylistController
  }

  public addEventListener(event: EventType, listener: Function) {
    this.eventManager.addEventListener(event, listener)
  }

  public removeEventListener(event: EventType, listener: Function) {
    this.eventManager.removeEventListener(event, listener)
  }

  public async switchPlaylist(playlistIndex: number) {
    if (playlistIndex !== this.dashPlaylistController.getCurrentPlaylistIndex()) {
      this.dashPlaylistController.switchPlaylist(playlistIndex)
      await this.init()
    }
  }

  public async init() {
    this.sourceBuffer.appendBuffer(await this.dashPlaylistController.getSegments().loadInitSegment())
  }

  public setSegmentFetchDelay(delay: number) {
    this.segmentFetchDelay = delay
  }

  public hasBufferReachedEnd() {
    return this.currentSegmentIndex >= this.dashPlaylistController.getSegments().getSegmentCount()
  }

  public shouldFetchNextSegment() {
    if (this._isFetchingSegment || this.sourceBuffer.updating || this.hasBufferReachedEnd()) {
      return false
    }

    const { buffered, currentTime } = this.videoElement
    if (buffered == null || currentTime == null) {
      return false
    }

    const end = buffered.length > 0 ? buffered.end(buffered.length - 1) : Number.NEGATIVE_INFINITY

    return currentTime + this.segmentFetchDelay >= end
  }

  public async updateBuffer() {
    const averageBandwidth = this.abrManager.getAverageBandwidth() * 0.75
    const bestPlaylistIndex = this.dashPlaylistController.getBestPlaylistForBandwidth(averageBandwidth)
    await this.switchPlaylist(bestPlaylistIndex)

    if (this.seekTo !== undefined) {
      this.sourceBuffer.abort()
      this.sourceBuffer.remove(0, this.videoElement.duration)
      this.currentSegmentIndex = this.dashPlaylistController.getSegments().getSegmentIndexAt(this.seekTo)
      this.seekTo = undefined
      return
    }

    if (this.shouldFetchNextSegment()) {
      await this._appendNextSegment()
    }
  }

  public async seek(time: number) {
    this.seekTo = time
  }

  private async _appendNextSegment() {
    let timeoutId
    const abortController = new AbortController()
    const segmentMetadata = this.dashPlaylistController.getSegments().getSegment(this.currentSegmentIndex)
    const maxRequestDuration = Math.max(2, segmentMetadata.duration)

    try {
      this._isFetchingSegment = true
      const start = Date.now()
      timeoutId = setTimeout(() => abortController.abort(), maxRequestDuration * 1000)
      const nextSegment = await this.dashPlaylistController
        .getSegments()
        .loadSegment(this.currentSegmentIndex, abortController.signal)
      const duration = (Date.now() - start) / 1000
      this.abrManager.addFetch({
        fetchDuration: duration,
        segmentBandwidth: this.dashPlaylistController.getPlaylist().attributes.BANDWIDTH,
        segmentDuration: this.dashPlaylistController.getSegments().getSegment(this.currentSegmentIndex).duration,
      })
      this.currentSegmentIndex++
      this.sourceBuffer.appendBuffer(nextSegment)
    } catch (e) {
      if (abortController.signal.aborted) {
        const estimatedBandwidthAfterFailure =
          ((segmentMetadata.duration * this.dashPlaylistController.getPlaylist().attributes.BANDWIDTH) /
            maxRequestDuration) *
          0.5
        for (let i = 0; i < this.abrManager.getFetchHistorySize(); i++) {
          this.abrManager.addFetch({
            fetchDuration: maxRequestDuration / 0.5,
            segmentBandwidth: this.dashPlaylistController.getPlaylist().attributes.BANDWIDTH,
            segmentDuration: segmentMetadata.duration,
          })
        }
        const bestPlaylistIndex =
          this.dashPlaylistController.getBestPlaylistForBandwidth(estimatedBandwidthAfterFailure)
        console.log(estimatedBandwidthAfterFailure, bestPlaylistIndex)
        await this.switchPlaylist(bestPlaylistIndex)
        return
      }

      console.error('Error fetching segment', e)
    } finally {
      clearTimeout(timeoutId)
      this._isFetchingSegment = false
    }
  }
}
