(function (f, a, y, D, o, v, S, h, m, _, A) {
  "use strict";
  
  const u = {
    DEFAULT_APP_NAME: "Music",
    DEFAULT_TIME_INTERVAL: 5,
    DEFAULT_APPLICATION_ID: "1054951789318909972",
    DEFAULT_LFM_API_KEY: "014ffe8a614370f000d85d95ec30e1be",
    LFM_DEFAULT_COVER_HASHES: [
      "2a96cbd8b46e442fc41c2b86b821562f",
      "c6f59c1e5e7240a4c0d427abd71f3dbb",
    ],
  };

  const F = A.findByProps("getAssetIds"),
    C = A.findByStoreName("SelfPresenceStore"),
    k = A.findByStoreName("UserStore");

  function p() {
    return w(null);
  }

  function w(e) {
    if (r.pluginStopped) {
      g(true);
      e = null;
    }
    r.lastActivity = e;
    a.FluxDispatcher.dispatch({
      type: "LOCAL_ACTIVITY_UPDATE",
      activity: e,
      pid: 2312,
      socketId: "Last.fm@Vendetta",
    });
  }

  async function U(e, t) {
    const appId = t || s.applicationId || u.DEFAULT_APPLICATION_ID;
    return e ? await F.fetchAssetIds(appId, e) : [];
  }

  async function getApplicationAvatar(appId) {
    try {
      const response = await fetch(`https://discord.com/api/v9/oauth2/applications/${appId}/rpc`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.icon ? `https://cdn.discordapp.com/app-icons/${appId}/${data.icon}.png` : null;
    } catch (error) {
      console.error("Failed to fetch application avatar:", error);
      return null;
    }
  }

  let R;
  const L = {};

  function c(e, t) {
    L[e] = t;
    R?.();
  }

  function M() {
    [, R] = h.useReducer(function (e) {
      return ~e;
    }, 0);
    return JSON.stringify(L, null, 4);
  }

  async function getTrackInfo(artist, track) {
    const apiKey = s.lfmApiKey || u.DEFAULT_LFM_API_KEY;
    const params = new URLSearchParams({
      method: "track.getInfo",
      api_key: apiKey,
      artist: artist,
      track: track,
      format: "json",
      username: s.username
    }).toString();
    
    try {
      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const trackData = data?.track;
      
      if (!trackData) return null;
      
      return {
        duration: trackData.duration ? parseInt(trackData.duration) : null,
        playcount: trackData.userplaycount || trackData.playcount || null
      };
    } catch (error) {
      console.error("Failed to fetch track info:", error);
      return null;
    }
  }

  async function O() {
    const apiKey = s.lfmApiKey || u.DEFAULT_LFM_API_KEY;
    const e = new URLSearchParams({
      method: "user.getrecenttracks",
      user: s.username,
      api_key: apiKey,
      format: "json",
      limit: "1",
      extended: "1",
    }).toString();
    
    const t = await fetch(`https://ws.audioscrobbler.com/2.0/?${e}`);
    if (!t.ok) {
      throw new Error(`Failed to fetch the latest scrobble: ${t.statusText}`);
    }
    
    const n = await t.json();
    const l = n?.recenttracks?.track?.[0];
    
    if (!l) {
      c("lastAPIResponse", l);
      throw n;
    }
    
    c("lastAPIResponse", l);
    
    const trackInfo = await getTrackInfo(l.artist.name, l.name);
    
    return {
      name: l.name,
      artist: l.artist.name,
      album: l.album["#text"],
      albumArt: await V(l.image?.find(function (K) {
        return K.size === "large";
      })?.["#text"]),
      url: l.url,
      date: l.date?.["#text"] ?? "now",
      nowPlaying: !!l["@attr"]?.nowplaying,
      loved: l.loved === "1",
      duration: trackInfo?.duration || null,
      playcount: trackInfo?.playcount || null
    };
  }

  async function V(e) {
    const isDefaultCover = u.LFM_DEFAULT_COVER_HASHES.some(function (t) {
      return e?.includes(t);
    });
    
    if (isDefaultCover || !e) {
      // Use application avatar as fallback
      const appId = s.applicationId || u.DEFAULT_APPLICATION_ID;
      const appAvatar = await getApplicationAvatar(appId);
      return appAvatar;
    }
    
    return e;
  }

  var x = (function (e) {
    return (
      (e[(e.PLAYING = 0)] = "PLAYING"),
      (e[(e.STREAMING = 1)] = "STREAMING"),
      (e[(e.LISTENING = 2)] = "LISTENING"),
      (e[(e.COMPETING = 5)] = "COMPETING"),
      e
    );
  })(x || {});

  const i = function () {
    for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++) {
      t[n] = arguments[n];
    }
    return s.verboseLogging && console.log(...t);
  };

  async function P() {
    if (r.pluginStopped) {
      i("--> Plugin is unloaded, aborting update()...");
      g();
      return;
    }
    
    i("--> Fetching last track...");
    
    if (!s.username) {
      S.showToast("Last.fm username is not set!", o.getAssetIDByName("Small"));
      g();
      throw new Error("Username is not set");
    }
    
    if (s.ignoreSpotify) {
      if (C.findActivity(function (n) {
        return n.sync_id;
      })) {
        i("--> Spotify is currently playing, aborting...");
        c("isSpotifyIgnored", true);
        p();
        return;
      } else {
        c("isSpotifyIgnored", false);
      }
    } else {
      c("isSpotifyIgnored", undefined);
    }
    
    const e = await O().catch(async function (n) {
      i("--> An error occurred while fetching the last track, aborting...");
      p();
      throw n;
    });
    
    c("lastTrack", e);
    
    if (!e.nowPlaying) {
      i("--> Last track is not currently playing, aborting...");
      p();
      return;
    }
    
    i("--> Track fetched!");
    
    if (r.lastTrackUrl === e.url) {
      i("--> Last track is the same as the previous one, aborting...");
      return;
    }
    
    const appId = s.applicationId || u.DEFAULT_APPLICATION_ID;
    const t = {
      name: s.appName || u.DEFAULT_APP_NAME,
      flags: 0,
      type: 2, // Always set to LISTENING (2)
      details: e.name,
      state: `by ${e.artist}`,
      application_id: appId,
    };
    
    r.lastTrackUrl = e.url;
    
    if (t.name.includes("{{")) {
      for (const n in e) {
        t.name = t.name.replace(`{{${n}}}`, e[n]);
      }
    }
    
    if (s.showTimestamp) {
      const now = Date.now();
      let actualStartTime = Math.floor(now / 1000);
      
      if (s.showProgressBar && e.duration && e.duration > 0) {
        const endTime = actualStartTime + e.duration;
        t.timestamps = { start: actualStartTime, end: endTime };
        i(`--> Setting timestamps: start=${actualStartTime}, end=${endTime}, duration=${e.duration}s`);
      } else {
        t.timestamps = { start: actualStartTime };
        i(`--> Setting song start time timestamp: ${actualStartTime}`);
      }
    }
    
    if (e.album) {
      const n = await U([e.albumArt], appId);
      t.assets = { large_image: n[0], large_text: `on ${e.album}` };
      
      if (e.loved) {
        t.assets.small_text = "♥ Loved Track";
      }
    }
    
    i("--> Setting activity...");
    c("lastActivity", t);
    i(t);
    
    try {
      w(t);
    } catch (n) {
      i("--> An error occurred while setting the activity");
      p();
      throw n;
    }
    
    i("--> Successfully set activity!");
  }

  function g(e = false) {
    r.lastActivity = null;
    r.lastTrackUrl = null;
    
    if (r.updateInterval) {
      clearInterval(r.updateInterval);
    }
    
    if (!e) {
      p();
    }
  }

  async function b() {
    if (r.pluginStopped) {
      throw new Error("Plugin is already stopped!");
    }
    
    g();
    let e = 0;
    
    await P().catch(function (t) {
      console.error(t);
      e++;
    });
    
    r.updateInterval = setInterval(function () {
      return P().then(function () {
        e = 0;
      }).catch(function (t) {
        console.error(t);
        ++e;
        if (e > 3) {
          console.error("Failed to fetch/set activity 3 times, aborting...");
          g();
        }
      });
    }, (Number(s.timeInterval) || u.DEFAULT_TIME_INTERVAL) * 1000);
  }

  const r = {};
  
  // Initialize default settings
  _.plugin.storage.ignoreSpotify ??= true;
  _.plugin.storage.showProgressBar ??= true;
  _.plugin.storage.applicationId ??= u.DEFAULT_APPLICATION_ID;
  _.plugin.storage.lfmApiKey ??= u.DEFAULT_LFM_API_KEY;
  
  const s = { ..._.plugin.storage };

  var B = {
    settings: h.lazy(function () {
      return Promise.resolve().then(function () {
        return H;
      });
    }),
    onLoad() {
      r.pluginStopped = false;
      
      if (k.getCurrentUser()) {
        b().catch(console.error);
      } else {
        const e = function () {
          b().catch(console.error);
          a.FluxDispatcher.unsubscribe(e);
        };
        a.FluxDispatcher.subscribe("CONNECTION_OPEN", e);
      }
    },
    onUnload() {
      r.pluginStopped = true;
      g();
    },
  };

  const {
    FormRow: N,
    FormInput: I,
    FormDivider: d,
    FormSwitchRow: T,
    FormText: G,
    FormIcon: E,
  } = v.Forms;

  function $() {
    async function e() {
      for (const t in y.storage) {
        if (y.storage[t] != null) {
          s[t] = y.storage[t];
        }
      }
      
      await b();
      S.showToast("Settings updated!", o.getAssetIDByName("Check"));
    }
    
    return a.React.createElement(
      m.TouchableOpacity,
      { onPress: e },
      a.React.createElement(G, { style: { marginRight: 12 } }, "UPDATE"),
    );
  }

  var z = a.React.memo(function () {
    const e = D.useProxy(y.storage);
    const t = a.NavigationNative.useNavigation();
    
    h.useEffect(function () {
      t.setOptions({ title: "Last.fm Configuration", headerRight: $ });
    }, []);
    
    return a.React.createElement(
      m.ScrollView,
      null,
      a.React.createElement(I, {
        value: e.appName || void 0,
        onChangeText: function (n) {
          return (e.appName = n.trim());
        },
        title: "Discord Application Name",
        placeholder: u.DEFAULT_APP_NAME,
        returnKeyType: "done",
      }),
      a.React.createElement(d, null),
      a.React.createElement(I, {
        value: e.applicationId || void 0,
        onChangeText: function (n) {
          return (e.applicationId = n.trim());
        },
        title: "Discord Application ID",
        placeholder: u.DEFAULT_APPLICATION_ID,
        returnKeyType: "done",
      }),
      a.React.createElement(d, null),
      a.React.createElement(I, {
        required: true,
        value: e.username || void 0,
        onChangeText: function (n) {
          return (e.username = n.trim());
        },
        title: "Last.fm username",
        helpText: !e.username && a.React.createElement(
          m.Text,
          { style: { color: "#FF0000" } },
          "This field is required!",
        ),
        placeholder: "mxtiy",
        returnKeyType: "done",
      }),
      a.React.createElement(d, null),
      a.React.createElement(I, {
        value: e.lfmApiKey || void 0,
        onChangeText: function (n) {
          return (e.lfmApiKey = n.trim());
        },
        title: "Last.fm API Key",
        placeholder: u.DEFAULT_LFM_API_KEY,
        returnKeyType: "done",
      }),
      a.React.createElement(d, null),
      a.React.createElement(I, {
        value: e.timeInterval,
        onChangeText: function (n) {
          return (e.timeInterval = n);
        },
        title: "Update interval (in seconds)",
        placeholder: u.DEFAULT_TIME_INTERVAL.toString(),
        keyboardType: "numeric",
        returnKeyType: "done",
      }),
      a.React.createElement(d, null),
      a.React.createElement(T, {
        label: "Show exact time",
        subLabel: "Show the current time when the song status was set",
        leading: a.React.createElement(E, {
          source: o.getAssetIDByName("clock"),
        }),
        value: e.showTimestamp,
        onValueChange: function (n) {
          return (e.showTimestamp = n);
        },
      }),
      a.React.createElement(d, null),
      a.React.createElement(T, {
        label: "Show progress bar",
        subLabel: "Show song progress bar (requires track duration data)",
        leading: a.React.createElement(E, {
          source: o.getAssetIDByName("ic_progress_activity"),
        }),
        value: e.showProgressBar,
        onValueChange: function (n) {
          return (e.showProgressBar = n);
        },
      }),
      a.React.createElement(d, null),
      a.React.createElement(T, {
        label: "Hide when Spotify is running",
        subLabel: "Hide the status when a Spotify activity is detected",
        leading: a.React.createElement(E, {
          source: o.getAssetIDByName("img_account_sync_spotify_light_and_dark"),
        }),
        value: e.ignoreSpotify,
        onValueChange: function (n) {
          return (e.ignoreSpotify = n);
        },
      }),
      a.React.createElement(d, null),
      a.React.createElement(N, {
        label: "Debug",
        subLabel: "View debug information",
        leading: a.React.createElement(E, {
          source: o.getAssetIDByName("debug"),
        }),
        trailing: N.Arrow,
        onPress: function () {
          t.push("VendettaCustomPage", {
            title: "Debug",
            render: h.lazy(function () {
              return Promise.resolve().then(function () {
                return j;
              });
            }),
          });
        },
      }),
    );
  });

  var H = Object.freeze({ __proto__: null, default: z });

  function Y() {
    const e = M();
    return React.createElement(
      m.ScrollView,
      null,
      React.createElement(
        v.Codeblock,
        { selectable: true, style: { margin: 12 } },
        e,
      ),
    );
  }

  var j = Object.freeze({ __proto__: null, default: Y });

  f.currentSettings = s;
  f.default = B;
  f.pluginState = r;
  Object.defineProperty(f, "__esModule", { value: true });
  
  return f;
})(
  {},
  vendetta.metro.common,
  vendetta.plugin,
  vendetta.storage,
  vendetta.ui.assets,
  vendetta.ui.components,
  vendetta.ui.toasts,
  window.React,
  vendetta.metro.common.ReactNative,
  vendetta,
  vendetta.metro,
);
