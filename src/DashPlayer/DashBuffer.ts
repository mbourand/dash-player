import { ABRController } from './ABRController'
import { DashSegments } from './DashSegments'
import { EventManager, EventType } from './EventManager'

export class DashBuffer {
  private sourceBuffer: SourceBuffer
  private segmentFetchDelay: number = 20
  private currentSegmentIndex: number = 0
  private videoElement: HTMLVideoElement
  private dashSegments: DashSegments

  private _isFetchingSegment: boolean = false

  private abrManager = new ABRController(10)
  private eventManager = new EventManager()

  constructor(videoElement: HTMLVideoElement, sourceBuffer: SourceBuffer, dashSegments: DashSegments) {
    this.sourceBuffer = sourceBuffer
    this.videoElement = videoElement
    this.dashSegments = dashSegments
  }

  public addEventListener(event: EventType, listener: Function) {
    this.eventManager.addEventListener(event, listener)
  }

  public removeEventListener(event: EventType, listener: Function) {
    this.eventManager.removeEventListener(event, listener)
  }

  public async init() {
    this.sourceBuffer.appendBuffer(await this.dashSegments.loadInitSegment())
    this.sourceBuffer.addEventListener('updateend', () => {
      if (this.hasBufferReachedEnd()) {
        this.eventManager.emit(EventType.BufferReachedEnd)
      }
    })
  }

  public setSegmentFetchDelay(delay: number) {
    this.segmentFetchDelay = delay
  }

  public hasBufferReachedEnd() {
    return this.currentSegmentIndex >= this.dashSegments.getSegmentCount()
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
    // TODO: Try to find the best quality where the average fetch time will be less than 1
    if (this.shouldFetchNextSegment()) {
      await this._appendNextSegment()
    }
  }

  public async seek(time: number) {
    this.sourceBuffer.abort()
    this.sourceBuffer.remove(0, this.videoElement.duration)
    this.currentSegmentIndex = this.dashSegments.getSegmentIndexAt(time)
  }

  private async _appendNextSegment() {
    try {
      this._isFetchingSegment = true
      const start = Date.now()
      const nextSegment = await this.dashSegments.loadSegment(this.currentSegmentIndex)
      const duration = (Date.now() - start) / 1000
      this.abrManager.addFetch({
        fetchDuration: duration,
        segmentDuration: this.dashSegments.getSegment(this.currentSegmentIndex).duration,
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
