import User from '../models/user.js';

export const signUp = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Signup attempt:', email);

        let user = await User.findOne({ email });
        if (user) {
            console.log('Signup failed: User already exists:', email);
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        user = new User({ email, password });
        await user.save();
        console.log('User created successfully:', user._id);

        req.session.userId = user._id;
        req.session.email = user.email;

        res.status(201).json({ 
            message: 'User created successfully!', 
            userId: user._id,
            email: user.email 
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Signin attempt:', email);

        const user = await User.findOne({ email });
        if (!user) {
            console.log('Signin failed: User not found:', email);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Signin failed: Incorrect password for:', email);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // Regenerate session to prevent session fixation attacks
        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regeneration error:', err);
                return res.status(500).json({ message: 'Session error, please try again.' });
            }

            // Set session data
            req.session.userId = user._id;
            req.session.email = user.email;
            req.session.loginTime = new Date();
            
            console.log('Signin successful:', user._id, 'Session ID:', req.sessionID);

            res.status(200).json({ 
                message: 'Signed in successfully!', 
                userId: user._id,
                email: user.email,
                sessionId: req.sessionID,
                isAuthenticated: true
            });
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const signOut = (req, res) => {
    const sessionId = req.sessionID;
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Signout error:', err);
            return res.status(500).json({ message: 'Could not sign out, please try again.' });
        }
        
        console.log('Signout successful for session:', sessionId);
        
        // Clear all possible session cookies
        res.clearCookie('demai.sid');
        res.clearCookie('connect.sid');
        res.clearCookie('sessionId');
        
        res.status(200).json({ 
            message: 'Signed out successfully.',
            isAuthenticated: false
        });
    });
};

export const getCurrentUser = (req, res) => {
    if (req.session.userId) {
        console.log('Current user session:', req.session.userId);
        res.status(200).json({
            userId: req.session.userId,
            email: req.session.email,
            isAuthenticated: true
        });
    } else {
        console.log('No authenticated user in session.');
        res.status(401).json({
            message: 'Not authenticated',
            isAuthenticated: false
        });
    }
};
