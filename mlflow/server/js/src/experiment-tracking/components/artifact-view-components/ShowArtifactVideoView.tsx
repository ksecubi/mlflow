import React, { useEffect, useState } from 'react';
import { LegacySkeleton } from '@databricks/design-system';
import {
  getArtifactBlob,
  getLoggedModelArtifactLocationUrl,
  resolveArtifactContentUrl,
} from '../../../common/utils/ArtifactUtils';
import type { LoggedModelArtifactViewerProps } from './ArtifactViewComponents.types';

type Props = {
  runUuid: string;
  path: string;
  artifactRootUri?: string;
  getArtifact?: (...args: any[]) => any;
} & LoggedModelArtifactViewerProps;

const ShowArtifactVideoView = ({
  runUuid,
  path,
  artifactRootUri,
  getArtifact = getArtifactBlob,
  isLoggedModelsMode,
  loggedModelId,
}: Props) => {
  const [videoUrl, setVideoUrl] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objUrl: string | undefined;
    let cancelled = false;

    const artifactUrlPromise =
      isLoggedModelsMode && loggedModelId
        ? Promise.resolve(getLoggedModelArtifactLocationUrl(path, loggedModelId))
        : resolveArtifactContentUrl(runUuid, path, artifactRootUri);

    artifactUrlPromise
      .then((artifactUrl) => getArtifact(artifactUrl))
      .then((blob: Blob) => {
        if (cancelled) return;
        objUrl = URL.createObjectURL(blob);
        setVideoUrl(objUrl);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [runUuid, path, artifactRootUri, isLoggedModelsMode, loggedModelId, getArtifact]);

  const classNames = {
    videoOuterContainer: {
      padding: 10,
      overflow: 'hidden',
      background: 'black',
      minHeight: '100%',
    },
    hidden: { display: 'none' },
    video: {
      maxWidth: '100%',
      maxHeight: '62.5vh',
      objectFit: 'fit',
      display: 'block',
    },
  };

  return (
    <div css={{ flex: 1 }}>
      <div css={classNames.videoOuterContainer}>
        {loading && <LegacySkeleton active />}
        {videoUrl && (
          <video
            css={loading ? classNames.hidden : classNames.video}
            src={videoUrl}
            controls
            preload="auto"
            aria-label="video"
          >
            <track kind="captions" srcLang="en" src="" default />
          </video>
        )}
      </div>
    </div>
  );
};

export default ShowArtifactVideoView;
