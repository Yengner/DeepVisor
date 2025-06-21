'use client';

import { Button, Text, Title, Stack, Group, Select, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuilding } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { updateBusinessProfileData } from '@/lib/actions/user.actions';

type BusinessProfileStepProps = {
  onNext: () => void;
  onPrev: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateUserData: (data: any) => void;
};

export default function BusinessProfileStep({
  onNext,
  onPrev,
  userData,
  updateUserData
}: BusinessProfileStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const formInitialized = useRef(false);

  // Log what we're initializing with
  useEffect(() => {
    console.log("BusinessProfileStep initial userData:", {
      businessName: userData.businessName,
      businessType: userData.businessType,
      industry: userData.industry,
      website: userData.website,
      description: userData.description,
      monthlyBudget: userData.monthlyBudget
    });
    formInitialized.current = true;
  }, []);

  const form = useForm({
    initialValues: {
      businessName: userData.businessName || '',
      businessType: userData.businessType || '',
      industry: userData.industry || '',
      website: userData.website || '',
      description: userData.description || '',
      monthlyBudget: userData.monthlyBudget || '',
    },
    validate: {
      businessName: (value) => !value ? 'Business name is required' : null,
      businessType: (value) => !value ? 'Business type is required' : null,
      industry: (value) => !value ? 'Industry is required' : null,
    },
    onValuesChange: (values) => {
      // Only update after form is initialized to prevent wipes
      if (formInitialized.current) {
        console.log("Updating user data in BusinessProfileStep:", values);
        updateUserData({
          ...userData,
          businessName: values.businessName,
          businessType: values.businessType,
          industry: values.industry,
          website: values.website,
          description: values.description,
          monthlyBudget: values.monthlyBudget
        });
      }
    }
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      // Log what we're about to send
      console.log("Submitting business profile:", values);
      
      // Update parent state
      updateUserData({
        ...userData,
        businessName: values.businessName,
        businessType: values.businessType,
        industry: values.industry,
        website: values.website,
        description: values.description,
        monthlyBudget: values.monthlyBudget
      });
      
      // Save directly to database for additional safety
      await updateBusinessProfileData({
        businessName: values.businessName,
        businessType: values.businessType,
        industry: values.industry,
        website: values.website,
        description: values.description,
        monthlyBudget: values.monthlyBudget
      });
      
      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Error saving business profile:', error);
      toast.error('Failed to save your business profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="xl" py={20}>
      <Title order={2} ta="center">Business Profile</Title>

      <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
        Tell us about your business to help us personalize your experience
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Business Name"
            placeholder="Your business name"
            required
            leftSection={<IconBuilding size={16} />}
            {...form.getInputProps('businessName')}
          />

          <Group grow>
            <Select
              label="Business Type"
              placeholder="Select business type"
              required
              data={[
                { value: 'ecommerce', label: 'Ecommerce' },
                { value: 'service', label: 'Service-based' },
                { value: 'local', label: 'Local Business' },
                { value: 'agency', label: 'Agency' },
                { value: 'saas', label: 'SaaS / Software' },
                { value: 'other', label: 'Other' },
              ]}
              {...form.getInputProps('businessType')}
            />

            <Select
              label="Industry"
              placeholder="Select industry"
              required
              data={[
                { value: 'retail', label: 'Retail' },
                { value: 'technology', label: 'Technology' },
                { value: 'healthcare', label: 'Healthcare' },
                { value: 'finance', label: 'Finance' },
                { value: 'education', label: 'Education' },
                { value: 'food', label: 'Food & Restaurant' },
                { value: 'travel', label: 'Travel' },
                { value: 'entertainment', label: 'Entertainment' },
                { value: 'fashion', label: 'Fashion' },
                { value: 'other', label: 'Other' },
              ]}
              {...form.getInputProps('industry')}
            />
          </Group>

          <TextInput
            label="Website"
            placeholder="https://yourbusiness.com"
            {...form.getInputProps('website')}
          />

          <Textarea
            label="Business Description"
            placeholder="Tell us briefly about your business"
            minRows={3}
            {...form.getInputProps('description')}
          />

          <Select
            label="Monthly Ad Budget"
            placeholder="Select budget range"
            data={[
              { value: 'under_1000', label: 'Under $1,000' },
              { value: '1000_5000', label: '$1,000 - $5,000' },
              { value: '5000_10000', label: '$5,000 - $10,000' },
              { value: '10000_50000', label: '$10,000 - $50,000' },
              { value: 'over_50000', label: 'Over $50,000' },
            ]}
            {...form.getInputProps('monthlyBudget')}
          />
        </Stack>

        <Group justify="apart" mt="xl">
          <Button variant="light" onClick={onPrev} type="button">
            Back
          </Button>
          <Button type="submit" loading={submitting}>
            Continue
          </Button>
        </Group>
      </form>
    </Stack>
  );
}