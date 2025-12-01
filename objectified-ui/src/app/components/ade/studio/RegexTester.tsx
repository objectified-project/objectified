'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface RegexTesterProps {
  pattern: string;
}

export const RegexTester: React.FC<RegexTesterProps> = ({ pattern }) => {
  const [testString, setTestString] = useState('');
  const [testResult, setTestResult] = useState<{ matches: boolean; error?: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTest = () => {
    if (!pattern.trim()) {
      setTestResult({ matches: false, error: 'Please enter a regex pattern first' });
      return;
    }

    try {
      const regex = new RegExp(pattern);
      const matches = regex.test(testString);
      setTestResult({ matches });
    } catch (error) {
      setTestResult({
        matches: false,
        error: `Invalid regex: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTest();
    }
  };

  if (!pattern.trim()) {
    return null;
  }

  return (
    <Box sx={{ mb: 2, mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setExpanded(!expanded)}
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          Test Regex
        </Button>
        {testResult && !testResult.error && (
          <Chip
            label={testResult.matches ? 'Match' : 'No Match'}
            color={testResult.matches ? 'success' : 'default'}
            size="small"
            icon={testResult.matches ? <CheckCircleIcon /> : <CancelIcon />}
          />
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Current pattern: <Box component="code" sx={{
              bgcolor: 'action.selected',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              color: 'text.primary'
            }}>{pattern}</Box>
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              label="Test String"
              size="small"
              fullWidth
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter text to test against the pattern"
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleTest}
              sx={{ minWidth: '80px', mt: 0.5 }}
            >
              Test
            </Button>
          </Box>

          {testResult && (
            <Box sx={{ mt: 2 }}>
              {testResult.error ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {testResult.error}
                </Alert>
              ) : (
                <Alert
                  severity={testResult.matches ? 'success' : 'info'}
                  sx={{ py: 0.5 }}
                  icon={testResult.matches ? <CheckCircleIcon /> : <CancelIcon />}
                >
                  {testResult.matches ? (
                    <>Pattern matches the test string</>
                  ) : (
                    <>Pattern does not match the test string</>
                  )}
                </Alert>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

