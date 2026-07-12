import {
  analyzeFolderGlossaryCoverageRows,
  type FolderGlossaryCoverageAnalysisInput,
  type FolderGlossaryCoverageReport,
} from "./folderGlossaryCoverage";

interface CoverageWorkerSuccess {
  ok: true;
  report: FolderGlossaryCoverageReport;
}

interface CoverageWorkerFailure {
  ok: false;
  error: string;
}

type CoverageWorkerResponse = CoverageWorkerSuccess | CoverageWorkerFailure;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<FolderGlossaryCoverageAnalysisInput>) => void) | null;
  postMessage: (message: CoverageWorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  try {
    workerScope.postMessage({
      ok: true,
      report: analyzeFolderGlossaryCoverageRows(event.data),
    });
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível analisar a cobertura.",
    });
  }
};
