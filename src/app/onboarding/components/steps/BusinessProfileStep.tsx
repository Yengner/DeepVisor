'use client';

import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import { Button, Text, Title, Stack, Group, Select, TextInput, Textarea, Card } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuilding } from '@tabler/icons-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

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

  const form = useForm({
    initialValues: {
      businessName: userData.businessName || '',
      industry: userData.industry || '',
      website: userData.website || '',
      description: userData.description || '',
      monthlyBudget: userData.monthlyBudget || '',
    },
    validate: {
      businessName: (value) => !value ? 'Business name is required' : null,
      industry: (value) => !value ? 'Industry is required' : null,
      description: (value) => !value ? 'A short business context is required' : null,
      monthlyBudget: (value) => !value ? 'Monthly ad budget is required' : null,
    },
    onValuesChange: (values) => {
      updateUserData({
        ...userData,
        businessName: values.businessName,
        industry: values.industry,
        website: values.website,
        description: values.description,
        monthlyBudget: values.monthlyBudget
      });
    }
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      updateUserData({
        ...userData,
        businessName: values.businessName,
        industry: values.industry,
        website: values.website,
        description: values.description,
        monthlyBudget: values.monthlyBudget
      });

      const saveRes = await updateBusinessProfileData({
        businessName: values.businessName,
        industry: values.industry,
        website: values.website,
        description: values.description,
        monthlyBudget: values.monthlyBudget
      });
      if (!saveRes.success) {
        toast.error(saveRes.error.userMessage);
        return;
      }

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
    <Stack gap="xl" py={16}>
      <div>
        <Title order={2} ta="center">Tell us what this business is</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
          This gives DeepVisor enough owner context to judge whether recommendations fit the actual business, not just the ad account metrics.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <TextInput
              label="Business name"
              placeholder="Your business name"
              description="This becomes the name of your business workspace."
              required
              leftSection={<IconBuilding size={16} />}
              {...form.getInputProps('businessName')}
            />

            <Select
              label="Industry"
              placeholder="Select industry"
              description="Used for reporting baselines and recommendation context."
              required
              data={[
                { value: 'local_services', label: 'Local services' },
                { value: 'home_services', label: 'Home services' },
                { value: 'health_wellness', label: 'Health & wellness' },
                { value: 'professional_services', label: 'Professional services' },
                { value: 'ecommerce', label: 'Ecommerce / retail' },
                { value: 'restaurant_food', label: 'Restaurant / food' },
                { value: 'education', label: 'Education' },
                { value: 'real_estate', label: 'Real estate' },
                { value: 'saas_technology', label: 'SaaS / technology' },
                { value: 'other', label: 'Other' },
              ]}
              {...form.getInputProps('industry')}
            />

            <TextInput
              label="Website"
              placeholder="https://yourbusiness.com"
              description="Optional. Adds context to your profile."
              {...form.getInputProps('website')}
            />

            <Textarea
              label="What do you sell and who are you trying to reach?"
              placeholder="Example: We sell HVAC repair and installation to homeowners within 30 miles of Miami. Most valuable leads are emergency repair calls and replacement quotes."
              description="This is the most important non-platform input for recommendations."
              minRows={4}
              required
              {...form.getInputProps('description')}
            />

            <Select
              label="Monthly ad budget"
              placeholder="Select budget range"
              description="Used for pacing suggestions and guardrails."
              required
              data={[
                { value: 'not_sure', label: 'Not sure yet' },
                { value: 'under_1000', label: 'Under $1,000' },
                { value: '1000_5000', label: '$1,000 - $5,000' },
                { value: '5000_10000', label: '$5,000 - $10,000' },
                { value: '10000_50000', label: '$10,000 - $50,000' },
                { value: 'over_50000', label: 'Over $50,000' },
              ]}
              {...form.getInputProps('monthlyBudget')}
            />
          </Stack>
        </Card>

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
