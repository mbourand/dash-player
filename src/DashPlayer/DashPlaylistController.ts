import { DashSegments } from './DashSegments'

export class DashPlaylistController {
  private segments: DashSegments
  private playlists: any[]
  private currentPlaylistIndex: number

  constructor(playlists: any[], currentPlaylistIndex: number) {
    this.playlists = playlists
    this.currentPlaylistIndex = currentPlaylistIndex
    this.segments = new DashSegments(playlists[currentPlaylistIndex].segments)
  }

  public getPlaylist(index = this.currentPlaylistIndex) {
    return this.playlists[index]
  }

  public getCurrentPlaylistIndex() {
    return this.currentPlaylistIndex
  }

  public getSegments() {
    return this.segments
  }

  public switchPlaylist(playlistIndex: number) {
    if (playlistIndex === this.currentPlaylistIndex) return

    this.currentPlaylistIndex = playlistIndex
    this.segments = new DashSegments(this.playlists[playlistIndex].segments)
  }

  public getBestPlaylistForBandwidth(bandwidth: number): number {
    if (isNaN(bandwidth))
      return this.playlists.reduce(
        (acc, _, i) => (this.playlists[i].attributes.BANDWIDTH > this.playlists[acc].attributes.BANDWIDTH ? i : acc),
        0
      )

    const res = this.playlists.reduce((best, _, i) => {
      const canHandleBitrate = this.playlists[i].attributes.BANDWIDTH < bandwidth
      const isHigherQuality =
        best === undefined ? true : this.playlists[i].attributes.BANDWIDTH > this.playlists[best].attributes.BANDWIDTH
      return canHandleBitrate && isHigherQuality ? i : best
    }, undefined)

    return (
      res ??
      this.playlists.reduce(
        (acc, _, i) => (this.playlists[i].attributes.BANDWIDTH < this.playlists[acc].attributes.BANDWIDTH ? i : acc),
        0
      )
    )
  }
}
