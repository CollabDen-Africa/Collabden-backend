const {
  uploadAgreementService,
  getAgreementsService,
  updateAgreementStatusService,
  uploadSignedAgreementService,
  esignAgreementService,
  editAgreementService,
  getUserAgreementsService,
  downloadAgreementService,
  getAgreementPermissionsService,
  updateAgreementPermissionService,
  getUserAgreementActivityService,
  requestAgreementCancellationService,
  respondToAgreementCancellationService,
  deleteAgreementService,
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
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

const getAgreementsHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    const agreements = await getAgreementsService(projectId);
    return res.status(200).json({ agreements });
  } catch (error) {
    console.error('Error in getAgreementsHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
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
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
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
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
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
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
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
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

const getUserAgreementsHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserAgreementsService(userId, req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getUserAgreementsHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

const downloadAgreementHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { buffer, filename, contentType } = await downloadAgreementService(id, userId);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('Error in downloadAgreementHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

// FR96: get permission records for an agreement (owner only)
const getAgreementPermissionsHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;

    const permissions = await getAgreementPermissionsService(id, requesterId);
    return res.status(200).json({ permissions });
  } catch (error) {
    console.error('Error in getAgreementPermissionsHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

// FR96: upsert a collaborator's permission record (owner only)
const updateAgreementPermissionHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const { userId: targetUserId, canView, canSign, canEdit } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'userId of the target collaborator is required.' });
    }

    const permission = await updateAgreementPermissionService(
      id, requesterId, targetUserId, { canView, canSign, canEdit }
    );
    return res.status(200).json({ message: 'Permission updated.', permission });
  } catch (error) {
    console.error('Error in updateAgreementPermissionHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

// FR109: user's personal agreement activity history
const getUserAgreementActivityHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserAgreementActivityService(userId, req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getUserAgreementActivityHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

// Request mutual cancellation of an agreement (any party)
const requestAgreementCancellationHandler = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body || {};

    if (reason !== undefined && reason !== null && typeof reason !== 'string') {
      return res.status(400).json({ error: 'Reason must be a string.' });
    }

    const agreement = await requestAgreementCancellationService(id, projectId, userId, reason?.trim());
    const message = agreement.status === 'CANCELLED'
      ? 'Agreement cancelled.'
      : 'Cancellation requested. Awaiting consent from the other parties.';
    return res.status(200).json({ message, agreement });
  } catch (error) {
    console.error('Error in requestAgreementCancellationHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

// Approve or decline a pending cancellation request (any party)
const respondToAgreementCancellationHandler = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user.id;
    const decision = typeof req.body?.decision === 'string' ? req.body.decision.toUpperCase() : undefined;

    if (!['APPROVE', 'DECLINE'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be APPROVE or DECLINE.' });
    }

    const agreement = await respondToAgreementCancellationService(id, projectId, userId, decision);
    let message = 'Cancellation request declined.';
    if (agreement.status === 'CANCELLED') message = 'Agreement cancelled.';
    else if (decision === 'APPROVE') message = 'Cancellation approved. Awaiting consent from the other parties.';
    return res.status(200).json({ message, agreement });
  } catch (error) {
    console.error('Error in respondToAgreementCancellationHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

const deleteAgreementHandler = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user.id;

    await deleteAgreementService(id, projectId, userId);
    return res.status(200).json({ message: 'Agreement deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteAgreementHandler:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
  }
};

module.exports = {
  uploadAgreementHandler,
  getAgreementsHandler,
  updateAgreementStatusHandler,
  uploadSignedAgreementHandler,
  esignAgreementHandler,
  editAgreementHandler,
  getUserAgreementsHandler,
  downloadAgreementHandler,
  getAgreementPermissionsHandler,
  updateAgreementPermissionHandler,
  getUserAgreementActivityHandler,
  requestAgreementCancellationHandler,
  respondToAgreementCancellationHandler,
  deleteAgreementHandler,
};
