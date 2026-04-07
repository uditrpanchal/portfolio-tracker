import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import {
  Box, Button, Card, CssBaseline, Divider, FormControl,
  FormLabel, Stack, TextField, Typography, Alert,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useAuth } from '../contexts/AuthContext';

const SignInContainer = styled(Stack)(({ theme }) => ({
  minHeight: '100dvh',
  padding: theme.spacing(2),
  background: '#0A1628',
  alignItems: 'center',
  justifyContent: 'center',
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(4) },
}));

const StyledCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: 440,
  padding: theme.spacing(4),
  gap: theme.spacing(2.5),
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
}));

export default function SignIn() {
  const { loginWithGoogle, loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError(''); setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/investment/tracker', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError(''); setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/investment/tracker', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CssBaseline />
      <SignInContainer>
        <StyledCard variant="outlined">
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <TrendingUpIcon sx={{ color: '#2563EB', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={700} sx={{ color: '#F1F5F9', letterSpacing: '-0.3px' }}>
              Portfolio Tracker
            </Typography>
          </Box>

          <Typography variant="h4" component="h1" sx={{ color: '#F1F5F9', fontSize: 'clamp(1.6rem,5vw,2rem)', fontWeight: 700 }}>
            Sign in
          </Typography>

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          {/* Email/password form */}
          <Box component="form" onSubmit={handleEmailSignIn} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <FormLabel sx={{ color: '#E2E8F0', mb: 0.5 }}>Email</FormLabel>
              <TextField
                id="email" type="email" name="email" autoComplete="email" autoFocus required
                fullWidth placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                sx={inputSx}
              />
            </FormControl>
            <FormControl>
              <FormLabel sx={{ color: '#E2E8F0', mb: 0.5 }}>Password</FormLabel>
              <TextField
                id="password" type="password" name="password" autoComplete="current-password" required
                fullWidth placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                sx={inputSx}
              />
            </FormControl>
            <Button
              type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ mt: 1, py: 1.4, borderRadius: 2, background: '#2563EB', boxShadow: '0 0 20px rgba(37,99,235,0.4)',
                '&:hover': { background: '#1D4ED8', boxShadow: '0 0 28px rgba(37,99,235,0.6)' } }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
            </Button>
          </Box>

          <Divider sx={{ color: '#94A3B8', fontSize: 12 }}>or</Divider>

          {/* Google */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={res => res.credential && handleGoogle(res.credential)}
              onError={() => setError('Google sign-in failed.')}
              theme="filled_black"
              shape="rectangular"
              width="340"
              text="signin_with"
            />
          </Box>

          <Typography sx={{ textAlign: 'center', color: '#CBD5E1', fontSize: 13 }}>
            Don&apos;t have an account?{' '}
            <RouterLink to="/sign-up" style={{ color: '#60A5FA' }}>Sign up</RouterLink>
          </Typography>
        </StyledCard>
      </SignInContainer>
    </>
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#2563EB' },
  },
  '& .MuiOutlinedInput-input': { color: '#F1F5F9', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 },
};
