import { Router } from 'express';
import { getOrCreateProfile, ProfileModel, serializeProfile } from '../models/Profile';
import { asyncHandler } from '../utils/asyncHandler';
import { validateProfilePatch } from '../utils/validation';

export const profileRouter = Router();

profileRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const profile = await getOrCreateProfile();
    res.json(serializeProfile(profile.toObject()));
  })
);

profileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const result = validateProfilePatch(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid profile data', details: result.errors });
      return;
    }
    const profile = await getOrCreateProfile();
    const updated = await ProfileModel.findByIdAndUpdate(
      profile._id,
      { $set: result.value },
      { new: true, runValidators: true }
    ).lean();
    res.json(serializeProfile(updated ?? {}));
  })
);
