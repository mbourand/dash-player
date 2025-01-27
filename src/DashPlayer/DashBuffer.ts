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

  private abrManager = new ABRController(10)
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
    if (this._isFetchingSegment || this.hasBufferReachedEnd()) {
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
    const averageBandwidth = this.abrManager.getAverageBandwidth()
    const bestPlaylistIndex = this.dashPlaylistController.getBestPlaylistForBandwidth(averageBandwidth)
    console.log('Best playlist', bestPlaylistIndex)
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
    try {
      this._isFetchingSegment = true
      const start = Date.now()
      const nextSegment = await this.dashPlaylistController.getSegments().loadSegment(this.currentSegmentIndex)
      const duration = (Date.now() - start) / 1000
      this.abrManager.addFetch({
        fetchDuration: duration,
        segmentBandwidth: this.dashPlaylistController.getPlaylist().attributes.BANDWIDTH,
        segmentDuration: this.dashPlaylistController.getSegments().getSegment(this.currentSegmentIndex).duration,
      })
      this.currentSegmentIndex++
      this.sourceBuffer.appendBuffer(nextSegment)
    } catch (e) {
      console.error('Error fetching segment', e)
    } finally {
      this._isFetchingSegment = false
    }
  }
}
