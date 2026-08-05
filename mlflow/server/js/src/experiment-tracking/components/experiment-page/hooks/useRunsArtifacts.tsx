import { useEffect, useState } from 'react';
import { listArtifactsApi } from '../../../actions';
import type { ArtifactFileInfo, ArtifactListFilesResponse } from '../../../types';

const listArtifactsRecursive = async (
  runUuid: string,
  path = '',
): Promise<ArtifactFileInfo[]> => {
  const response = (await listArtifactsApi(runUuid, path).payload) as ArtifactListFilesResponse;

  let files: ArtifactFileInfo[] = [];

  for (const artifact of response.files) {
    if (artifact.is_dir) {
      files.push(...(await listArtifactsRecursive(runUuid, artifact.path)));
    } else {
      files.push(artifact);
    }
  }

  console.log("Recursive result:", runUuid, path, files);

  return files;
};

/**
 * Fetches artifacts given a list of run UUIDs
 * @param runUuids List of run UUIDs
 * @returns Object containing artifacts keyed by run UUID
 */
export const useRunsArtifacts = (runUuids: string[]) => {
  const [artifactsKeyedByRun, setArtifactsKeyedByRun] = useState<Record<string, ArtifactListFilesResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArtifacts = async () => {
      setIsLoading(true);
      setError(null);

      const artifactsByRun: Record<string, ArtifactListFilesResponse> = {};

      try {
        await Promise.all(
          runUuids.map(async (runUuid) => {
            const files = await listArtifactsRecursive(runUuid);

            console.log(
              `[${runUuid}]`,
              files.map((f) => f.path)
            );
        
            artifactsByRun[runUuid] = {
              files,
              root_uri: '', // or preserve the original value if needed
            } as ArtifactListFilesResponse;
          }),
        );

        console.log("artifactsByRun", artifactsByRun);
        setArtifactsKeyedByRun(artifactsByRun);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (runUuids.length > 0) {
      fetchArtifacts();
    } else {
      setArtifactsKeyedByRun({});
      setIsLoading(false);
    }
  }, [runUuids]);

  return { artifactsKeyedByRun, isLoading, error };
};
