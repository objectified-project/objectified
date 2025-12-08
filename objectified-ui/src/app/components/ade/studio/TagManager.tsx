'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { Edit, Trash2, Plus, Tag as TagIcon } from 'lucide-react';
import { createTag, updateTag, deleteTag } from '../../../../../lib/db/helper';
import { useDialog } from '../../providers/DialogProvider';

interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  tags: Tag[];
  onTagsChanged: () => void;
}

const TAG_COLORS = [
  { value: 'default', label: 'Default', color: 'default' },
  { value: 'primary', label: 'Primary', color: 'primary' },
  { value: 'secondary', label: 'Secondary', color: 'secondary' },
  { value: 'error', label: 'Red', color: 'error' },
  { value: 'warning', label: 'Orange', color: 'warning' },
  { value: 'info', label: 'Blue', color: 'info' },
  { value: 'success', label: 'Green', color: 'success' },
];

const TagManager = ({ open, onClose, projectId, tags, onTagsChanged }: TagManagerProps) => {
  const { confirm: confirmDialog } = useDialog();

  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: 'default',
    description: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingTag(null);
      setIsCreating(false);
      setFormData({ name: '', color: 'default', description: '' });
      setError('');
    }
  }, [open]);

  const handleStartCreate = () => {
    setFormData({ name: '', color: 'default', description: '' });
    setEditingTag(null);
    setIsCreating(true);
    setError('');
  };

  const handleStartEdit = (tag: Tag) => {
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
    });
    setEditingTag(tag);
    setIsCreating(false);
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setIsCreating(false);
    setFormData({ name: '', color: 'default', description: '' });
    setError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Tag name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let result;
      if (isCreating) {
        result = await createTag(
          projectId,
          formData.name,
          formData.color,
          formData.description || null
        );
      } else if (editingTag) {
        result = await updateTag(
          editingTag.id,
          formData.name,
          formData.color,
          formData.description || null
        );
      }

      const response = JSON.parse(result);
      if (!response.success) {
        setError(response.error || 'Failed to save tag');
        setSaving(false);
        return;
      }

      // Success - refresh tags and reset form
      onTagsChanged();
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving tag:', error);
      setError('An error occurred while saving the tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    const confirmed = await confirmDialog({
      title: 'Delete Tag',
      message: `Are you sure you want to delete the tag "${tag.name}"? This will remove it from all classes.`,
      confirmText: 'Delete',
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      const result = await deleteTag(tag.id);
      const response = JSON.parse(result);

      if (!response.success) {
        setError(response.error || 'Failed to delete tag');
        return;
      }

      onTagsChanged();
    } catch (error) {
      console.error('Error deleting tag:', error);
      setError('An error occurred while deleting the tag');
    }
  };

  const isEditing = isCreating || editingTag !== null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TagIcon size={20} />
          Manage Tags
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Edit/Create Form */}
        {isEditing && (
          <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <TextField
              label="Tag Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              autoFocus
            />

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Color</InputLabel>
              <Select
                value={formData.color}
                label="Color"
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              >
                {TAG_COLORS.map((colorOption) => (
                  <MenuItem key={colorOption.value} value={colorOption.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={colorOption.label}
                        color={colorOption.color as any}
                        size="small"
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              size="small"
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} variant="contained" disabled={saving}>
                {saving ? 'Saving...' : isCreating ? 'Create' : 'Update'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Create Button */}
        {!isEditing && (
          <Button
            startIcon={<Plus size={16} />}
            onClick={handleStartCreate}
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
          >
            Create New Tag
          </Button>
        )}

        {/* Tags List */}
        <List>
          {tags.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              No tags yet. Create your first tag to organize classes.
            </Box>
          ) : (
            tags.map((tag) => (
              <ListItem
                key={tag.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: editingTag?.id === tag.id ? 'action.selected' : 'background.paper',
                }}
              >
                <Chip
                  label={tag.name}
                  color={tag.color as any}
                  size="small"
                  sx={{ mr: 2 }}
                />
                <ListItemText
                  primary={tag.name}
                  secondary={tag.description || 'No description'}
                  sx={{ ml: 1 }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleStartEdit(tag)}
                    sx={{ mr: 0.5 }}
                  >
                    <Edit size={16} />
                  </IconButton>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDelete(tag)}
                    color="error"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagManager;

