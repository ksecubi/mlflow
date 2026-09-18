/**
 * NOTE: this code file was automatically migrated to TypeScript using ts-migrate and
 * may contain multiple `any` type annotations and `@ts-expect-error` directives.
 * If possible, please improve types while making changes to this file. If the type
 * annotations are already looking good, please remove this comment.
 */

import { ErrorWrapper } from './ErrorWrapper';
import { getAjaxUrl, getDefaultHeaders, HTTPMethods } from './FetchUtils';
import { MlflowService } from '../../experiment-tracking/sdk/MlflowService';
import { getMultipartDownloadsEnabledSync } from '../../experiment-tracking/hooks/useServerInfo';

const MLFLOW_ARTIFACTS_ROUTE_ANCHORS = [
  'api/2.0/mlflow-artifacts/artifacts/',
  'ajax-api/2.0/mlflow-artifacts/artifacts/',
];
const PRESIGNED_DOWNLOAD_FALLBACK_STATUSES = [400, 404, 501, 503];

const joinArtifactPaths = (rootPath: string, artifactPath: string) =>
  [rootPath.replace(/^\/+|\/+$/g, ''), artifactPath.replace(/^\/+/, '')].filter(Boolean).join('/');

const getDecodedPathname = (url: URL) => decodeURIComponent(url.pathname);

export const getProxiedArtifactDownloadPath = (artifactRootUri?: string, artifactPath?: string) => {
  if (!artifactRootUri || !artifactPath) {
    return undefined;
  }
  try {
    const parsedArtifactRootUri = new URL(artifactRootUri);
    if (parsedArtifactRootUri.protocol === 'mlflow-artifacts:') {
      return joinArtifactPaths(getDecodedPathname(parsedArtifactRootUri), artifactPath);
    }
    if (parsedArtifactRootUri.protocol === 'http:' || parsedArtifactRootUri.protocol === 'https:') {
      const rootPath = getDecodedPathname(parsedArtifactRootUri).replace(/^\/+/, '');
      const routeAnchor = MLFLOW_ARTIFACTS_ROUTE_ANCHORS.find((anchor) => rootPath.includes(anchor));
      if (routeAnchor) {
        const routeAnchorIndex = rootPath.indexOf(routeAnchor);
        return joinArtifactPaths(rootPath.slice(routeAnchorIndex + routeAnchor.length), artifactPath);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const shouldTryRunScopedPresignedDownload = (artifactRootUri?: string) => {
  if (!artifactRootUri) {
    return true;
  }
  try {
    const { protocol } = new URL(artifactRootUri);
    return protocol !== 'mlflow-artifacts:' && protocol !== 'http:' && protocol !== 'https:';
  } catch {
    return true;
  }
};

export const canFallBackFromPresignedDownloadError = (error: unknown) =>
  error instanceof ErrorWrapper && PRESIGNED_DOWNLOAD_FALLBACK_STATUSES.includes(error.getStatus());

/**
 * Async function to fetch and return the specified artifact blob from response.
 * Throw exception if the request fails.
 */
export async function getArtifactBlob(artifactLocation: any) {
  const getArtifactRequest = new Request(artifactLocation, {
    method: HTTPMethods.GET,
    redirect: 'follow',
    // TODO: fix types
    headers: new Headers(getDefaultHeaders(document.cookie) as any),
  });
  // eslint-disable-next-line no-restricted-globals -- See go/spog-fetch
  const response = await fetch(getArtifactRequest);

  if (!response.ok) {
    const errorMessage = (await response.text()) || response.statusText;
    throw new ErrorWrapper(errorMessage, response.status);
  }
  return response.blob();
}

class TextArtifactTooLargeError extends Error {}

/**
 * Async function to fetch and return the specified text artifact.
 * Avoids unnecessary conversion to blob, parses chunked responses directly to text.
 */
export const getArtifactChunkedText = async (artifactLocation: string) =>
  new Promise<string>(async (resolve, reject) => {
    const getArtifactRequest = new Request(artifactLocation, {
      method: HTTPMethods.GET,
      redirect: 'follow',
      headers: new Headers(getDefaultHeaders(document.cookie) as HeadersInit),
    });
    // eslint-disable-next-line no-restricted-globals -- See go/spog-fetch
    const response = await fetch(getArtifactRequest);

    if (!response.ok) {
      const errorMessage = (await response.text()) || response.statusText;
      reject(new ErrorWrapper(errorMessage, response.status));
      return;
    }
    const reader = response.body?.getReader();

    if (reader) {
      let resultData = '';
      const decoder = new TextDecoder();
      const appendChunk = async (result: ReadableStreamReadResult<Uint8Array>) => {
        const decodedChunk = decoder.decode(result.value || new Uint8Array(), {
          stream: !result.done,
        });
        resultData += decodedChunk;
        if (result.done) {
          resolve(resultData);
        } else {
          reader.read().then(appendChunk).catch(reject);
        }
      };

      reader.read().then(appendChunk).catch(reject);
    } else {
      reject(new Error("Can't get artifact data from the server"));
    }
  });

/**
 * Fetches the specified artifact, returning a Promise that resolves with
 * the raw content converted to text of the artifact if the fetch is
 * successful, and rejects otherwise
 */
export function getArtifactContent<R = unknown>(artifactLocation: string, isBinary = false): Promise<R> {
  return new Promise<R>(async (resolve, reject) => {
    try {
      const blob = await getArtifactBlob(artifactLocation);

      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        // Resolve promise with artifact contents
        // @ts-expect-error TS(2531): Object is possibly 'null'.
        resolve(event.target.result);
      };
      fileReader.onerror = (error) => {
        reject(error);
      };
      if (isBinary) {
        fileReader.readAsArrayBuffer(blob);
      } else {
        fileReader.readAsText(blob);
      }
    } catch (error) {
      // fail silently
      reject(error);
    }
  });
}

/**
 * Fetches the specified artifact, returning a Promise that resolves with
 * the raw content in bytes of the artifact if the fetch is successful, and rejects otherwise
 */
export function getArtifactBytesContent(artifactLocation: any) {
  return getArtifactContent(artifactLocation, true);
}

export const getLoggedModelArtifactLocationUrl = (path: string, loggedModelId: string) => {
  return getAjaxUrl(
    `ajax-api/2.0/mlflow/logged-models/${loggedModelId}/artifacts/files?artifact_file_path=${encodeURIComponent(path)}`,
  );
};

export const getArtifactLocationUrl = (path: string, runUuid: string) => {
  const artifactEndpointPath = getAjaxUrl('get-artifact');
  return `${artifactEndpointPath}?path=${encodeURIComponent(path)}&run_uuid=${encodeURIComponent(runUuid)}`;
};

/**
 * Resolves the URL to fetch an artifact's bytes from for preview, preferring a presigned URL
 * that lets the browser read directly from the underlying cloud storage (bypassing the
 * tracking server's proxy) and falling back to the proxied `get-artifact` endpoint when a
 * presigned URL isn't available, e.g. proxied `mlflow-artifacts:` storage, an older server, a
 * repo without presigned support, or headers the presigned URL can't carry.
 *
 * Mirrors the presigned-download logic in `ArtifactView.onDownloadClick`, except it fails open
 * to the proxied URL on any error (including 403) since a failed preview just degrades to the
 * existing proxied behavior, unlike a download where falling back could sidestep a permission
 * denial.
 */
export const resolveArtifactContentUrl = async (
  runUuid: string,
  artifactPath: string,
  artifactRootUri?: string,
): Promise<string> => {
  const proxiedArtifactDownloadPath = getProxiedArtifactDownloadPath(artifactRootUri, artifactPath);
  const multipartDownloadsEnabled = getMultipartDownloadsEnabledSync();
  try {
    if (multipartDownloadsEnabled && proxiedArtifactDownloadPath) {
      const response = await MlflowService.getMlflowArtifactsPresignedDownloadUrl(proxiedArtifactDownloadPath);
      if (response.url && Object.keys(response.headers ?? {}).length === 0) {
        return response.url;
      }
    } else if (!proxiedArtifactDownloadPath && shouldTryRunScopedPresignedDownload(artifactRootUri)) {
      const response = await MlflowService.createPresignedDownloadUrl({ run_id: runUuid, path: artifactPath });
      if (response.presigned_url && Object.keys(response.headers ?? {}).length === 0) {
        return response.presigned_url;
      }
    }
  } catch {
    // fall through to the proxied URL below
  }
  return getArtifactLocationUrl(artifactPath, runUuid);
};
