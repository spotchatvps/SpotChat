import QueueOption from "../../models/QueueOption";
import ShowService from "./ShowService";

interface QueueData {
  queueId?: string;
  title?: string;
  option?: string;
  message?: string;
  parentId?: string;
  optionType?: string;
  fileType?: string;
  path?: string;
  fileName?: string;
  finalize?: string | boolean;
  waitTreatment?: string | boolean;
}

const UpdateService = async (
  queueOptionId: number | string,
  queueOptionData: QueueData
): Promise<QueueOption> => {
  const queueOption = await ShowService(queueOptionId);

  if (queueOptionData?.parentId == "null") {
    queueOptionData.parentId = null;
  }

  if (queueOptionData?.path == null) {
    queueOptionData["fileName"] = "";
    queueOptionData["path"] = "";
    queueOptionData["fileType"] = "";
  }

  if (queueOptionData?.finalize == "true") {
    queueOptionData.finalize = true;
  }
  if (queueOptionData?.finalize == "false") {
    queueOptionData.finalize = false;
  }
  if (queueOptionData?.waitTreatment == "false") {
    queueOptionData.waitTreatment = false;
  }

  await queueOption.update(queueOptionData);

  return queueOption;
};

export default UpdateService;
