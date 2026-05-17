const {
  uploadAgreementService,
  getAgreementsService,
  updateAgreementStatusService,
  uploadSignedAgreementService,
  esignAgreementService,
  editAgreementService,
} = require('../services/agreement.service');

const uploadAgreementHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const agreement = await uploadAgreementService(file, projectId, userId);
    return res.status(201).json({ agreement });
  } catch (error) {
    console.error('Error in uploadAgreementHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

const getAgreementsHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    const agreements = await getAgreementsService(projectId);
    return res.status(200).json({ agreements });
  } catch (error) {
    console.error('Error in getAgreementsHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

const updateAgreementStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const agreement = await updateAgreementStatusService(id, status, userId);
    return res.status(200).json({ agreement });
  } catch (error) {
    console.error('Error in updateAgreementStatusHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

const uploadSignedAgreementHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No signed file uploaded.' });
    }

    const agreement = await uploadSignedAgreementService(id, file, userId);
    return res.status(200).json({ agreement });
  } catch (error) {
    console.error('Error in uploadSignedAgreementHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

const esignAgreementHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { intentToSign } = req.body;

    const agreement = await esignAgreementService(id, userId, intentToSign);
    return res.status(200).json({ message: 'Agreement successfully e-signed.', agreement });
  } catch (error) {
    console.error('Error in esignAgreementHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

const editAgreementHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const file = req.file;
    const updateData = req.body;

    const agreement = await editAgreementService(id, file, updateData, userId);
    return res.status(200).json({ message: 'Agreement updated successfully.', agreement });
  } catch (error) {
    console.error('Error in editAgreementHandler:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error.' });
  }
};

module.exports = {
  uploadAgreementHandler,
  getAgreementsService,
  getAgreementsHandler,
  updateAgreementStatusHandler,
  uploadSignedAgreementHandler,
  esignAgreementHandler,
  editAgreementHandler,
};
