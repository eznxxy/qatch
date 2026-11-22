// Runs INSIDE the captured tab via chrome.scripting.executeScript({ func }) in the isolated world.
// Chrome serializes this function, so it must be self-contained: no imports, no outer variables.
// It only reads raw values; parsing and validation happen in the worker (device-info.ts).

/** Raw device snapshot from the page. Treated as untrusted and validated on receipt. */
export async function readDeviceEnv(): Promise<unknown> {
  interface UaBrand {
    brand: string;
    version: string;
  }
  interface UaData {
    brands?: UaBrand[];
    platform?: string;
    mobile?: boolean;
    getHighEntropyValues?: (hints: string[]) => Promise<{
      platformVersion?: string;
      fullVersionList?: UaBrand[];
    }>;
  }
  interface NetworkInfo {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }

  const nav = navigator as Navigator & { userAgentData?: UaData; connection?: NetworkInfo };
  const uaData = nav.userAgentData;

  let highEntropy: { platformVersion?: string; fullVersionList?: UaBrand[] } = {};
  try {
    highEntropy =
      (await uaData?.getHighEntropyValues?.(['platformVersion', 'fullVersionList'])) ?? {};
  } catch {
    // Best effort: low-entropy brands and the UA string still identify the browser.
  }

  const connection = nav.connection;
  return {
    userAgent: nav.userAgent,
    uaData: uaData
      ? {
          brands: uaData.brands,
          fullVersionList: highEntropy.fullVersionList,
          platform: uaData.platform,
          platformVersion: highEntropy.platformVersion,
          mobile: uaData.mobile,
        }
      : undefined,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    screen: { w: window.screen.width, h: window.screen.height },
    dpr: window.devicePixelRatio,
    language: nav.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    url: location.href,
    connection: connection
      ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        }
      : undefined,
  };
}
