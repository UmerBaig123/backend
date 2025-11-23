import User from '../models/user.js';
import bcrypt from 'bcrypt';

// Update Account Information (full name, company name, phone - not email)
export const updateAccountInfo = async (req, res) => {
    try {
        console.log('=== UPDATE ACCOUNT INFO API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Request body:', req.body);

        const { fullName, companyName, phone } = req.body;

        // Validate required fields
        if (!fullName && !companyName && !phone) {
            return res.status(400).json({
                success: false,
                message: 'At least one field is required for update'
            });
        }

        // Find user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields
        const updateData = {};
        if (fullName !== undefined) updateData.fullName = fullName.trim();
        if (companyName !== undefined) updateData['company.name'] = companyName.trim();
        if (phone !== undefined) updateData.phone = phone.trim();

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            updateData,
            { new: true, runValidators: true }
        );

        console.log('Account info updated successfully');

        res.json({
            success: true,
            message: 'Account information updated successfully',
            data: {
                fullName: updatedUser.fullName,
                companyName: updatedUser.company.name,
                phone: updatedUser.phone
            }
        });

    } catch (error) {
        console.error('=== UPDATE ACCOUNT INFO ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error updating account information',
            error: error.message
        });
    }
};

// Update Company Information (company name, website, address)
export const updateCompanyInfo = async (req, res) => {
    try {
        console.log('=== UPDATE COMPANY INFO API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Request body:', req.body);

        const { companyName, website, address } = req.body;

        // Validate required fields
        if (!companyName && !website && !address) {
            return res.status(400).json({
                success: false,
                message: 'At least one field is required for update'
            });
        }

        // Find user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update company fields
        const updateData = {};
        if (companyName !== undefined) updateData['company.name'] = companyName.trim();
        if (website !== undefined) updateData['company.website'] = website.trim();
        if (address !== undefined) updateData['company.address'] = address.trim();

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            updateData,
            { new: true, runValidators: true }
        );

        console.log('Company info updated successfully');

        res.json({
            success: true,
            message: 'Company information updated successfully',
            data: {
                companyName: updatedUser.company.name,
                website: updatedUser.company.website,
                address: updatedUser.company.address
            }
        });

    } catch (error) {
        console.error('=== UPDATE COMPANY INFO ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error updating company information',
            error: error.message
        });
    }
};

// Update Notification Preferences
export const updateNotificationPreferences = async (req, res) => {
    try {
        console.log('=== UPDATE NOTIFICATION PREFERENCES API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Request body:', req.body);

        const { emailNotifications, bidUpdates, marketingCommunications } = req.body;

        // Validate required fields
        if (emailNotifications === undefined && bidUpdates === undefined && marketingCommunications === undefined) {
            return res.status(400).json({
                success: false,
                message: 'At least one notification preference is required for update'
            });
        }

        // Find user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update notification preferences
        const updateData = {};
        if (emailNotifications !== undefined) updateData['notifications.emailNotifications'] = Boolean(emailNotifications);
        if (bidUpdates !== undefined) updateData['notifications.bidUpdates'] = Boolean(bidUpdates);
        if (marketingCommunications !== undefined) updateData['notifications.marketingCommunications'] = Boolean(marketingCommunications);

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            updateData,
            { new: true, runValidators: true }
        );

        console.log('Notification preferences updated successfully');

        res.json({
            success: true,
            message: 'Notification preferences updated successfully',
            data: {
                emailNotifications: updatedUser.notifications.emailNotifications,
                bidUpdates: updatedUser.notifications.bidUpdates,
                marketingCommunications: updatedUser.notifications.marketingCommunications
            }
        });

    } catch (error) {
        console.error('=== UPDATE NOTIFICATION PREFERENCES ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error updating notification preferences',
            error: error.message
        });
    }
};

// Update Password (Security)
export const updatePassword = async (req, res) => {
    try {
        console.log('=== UPDATE PASSWORD API CALLED ===');
        console.log('User ID:', req.session.userId);

        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password, new password, and confirm password are required'
            });
        }

        // Validate new password
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Validate password confirmation
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password do not match'
            });
        }

        // Find user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        console.log('Password updated successfully');

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('=== UPDATE PASSWORD ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error updating password',
            error: error.message
        });
    }
};

// Get User Profile Information
export const getUserProfile = async (req, res) => {
    try {
        console.log('=== GET USER PROFILE API CALLED ===');
        console.log('User ID:', req.session.userId);

        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                company: {
                    name: user.company.name,
                    website: user.company.website,
                    address: user.company.address
                },
                notifications: {
                    emailNotifications: user.notifications.emailNotifications,
                    bidUpdates: user.notifications.bidUpdates,
                    marketingCommunications: user.notifications.marketingCommunications
                }
            }
        });

    } catch (error) {
        console.error('=== GET USER PROFILE ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile',
            error: error.message
        });
    }
};
