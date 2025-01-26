import { DashPlayer } from "./DashPlayer/DashPlayer.ts";

const manifestUrl = "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd";
const player = new DashPlayer();
player.attachTo(document.getElementById("dash-player") as HTMLVideoElement);
player.load(manifestUrl);
