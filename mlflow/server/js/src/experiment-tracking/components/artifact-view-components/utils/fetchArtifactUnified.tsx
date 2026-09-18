import { useCallback } from 'react';
import {
  type getArtifactBytesContent,
  getArtifactContent,
  getLoggedModelArtifactLocationUrl,
  resolveArtifactContentUrl,
} from '../../../../common/utils/ArtifactUtils';
import type { KeyValueEntity } from '../../../../common/types';

type FetchArtifactParams = {
  experimentId?: string;
  runUuid: string;
  path: string;
  isLoggedModelsMode?: boolean;
  loggedModelId?: string;
  entityTags?: Partial<KeyValueEntity>[];
  artifactRootUri?: string;
};

type GetArtifactContentFn = typeof getArtifactContent | typeof getArtifactBytesContent;

// Internal util, strips leading slash from the path if it exists
const normalizeArtifactPath = (path: string) => (path.startsWith('/') ? path.substring(1) : path);

// Internal util that resolves the artifact location URL for the workspace API, preferring a
// presigned URL that lets the browser fetch directly from cloud storage
const getWorkspaceArtifactLocationUrl = (params: FetchArtifactParams) => {
  const { runUuid, path, isLoggedModelsMode, loggedModelId, artifactRootUri } = params;
  if (isLoggedModelsMode && loggedModelId) {
    return Promise.resolve(getLoggedModelArtifactLocationUrl(path, loggedModelId));
  }
  return resolveArtifactContentUrl(runUuid, path, artifactRootUri);
};

/**
 * A function that provides a unified function for fetching artifacts, either from the workspace API or SPN API.
 */
export const fetchArtifactUnified = async (
  params: FetchArtifactParams,
  getArtifactDataFn: GetArtifactContentFn = getArtifactContent,
) => {
  const workspaceAPIArtifactLocation = await getWorkspaceArtifactLocationUrl(params);

  return getArtifactDataFn(workspaceAPIArtifactLocation);
};

export type FetchArtifactUnifiedFn<T = string> = (
  params: FetchArtifactParams,
  getArtifactDataFn: GetArtifactContentFn,
) => Promise<T>;
