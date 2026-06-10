import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  version: '0.2.0',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  permissions: ['downloads', 'sidePanel', 'offscreen', 'debugger'],
  host_permissions: ['https://www.hipass.co.kr/*'],
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/sw.ts',
    type: 'module',
  },
  action: {
    default_title: '하이패스 영수증 다운로더',
    default_icon: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
