'use client';

import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import { Button, Text, Title, Stack, Group, Select, TextInput, Textarea, Card, SimpleGrid } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuilding } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
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
  const formInitialized = useRef(false);

  // Log what we're initializing with

  /* eslint-disable */
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
  /* eslint-enable */

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
        <Title order={2} ta="center">Business Profile</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
          A few details help us tailor insights and recommendations.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <TextInput
              label="Business Name"
              placeholder="Your business name"
              description="This appears on reports and dashboards."
              required
              leftSection={<IconBuilding size={16} />}
              {...form.getInputProps('businessName')}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Business Type"
                placeholder="Select business type"
                description="Helps us tailor benchmarks and recommendations."
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
                description="Used for reporting baselines."
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
            </SimpleGrid>

            <TextInput
              label="Website"
              placeholder="https://yourbusiness.com"
              description="Optional. Adds context to your profile."
              {...form.getInputProps('website')}
            />

            <Textarea
              label="Business Description"
              placeholder="Tell us briefly about your business"
              description="Optional. Helps us personalize insights."
              minRows={3}
              {...form.getInputProps('description')}
            />

            <Select
              label="Monthly Ad Budget"
              placeholder="Select budget range"
              description="Used for pacing suggestions and guardrails."
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
