#
# File:       sample_pass.rb
#
# Abstract:   Pass Server reference implementation
#
# Version:    1.0
#
# Disclaimer: IMPORTANT:  This Apple software is supplied to you by Apple Inc. ("Apple")
#             in consideration of your agreement to the following terms, and your use,
#             installation, modification or redistribution of this Apple software
#             constitutes acceptance of these terms.  If you do not agree with these
#             terms, please do not use, install, modify or redistribute this Apple
#             software.
#
#             In consideration of your agreement to abide by the following terms, and
#             subject to these terms, Apple grants you a personal, non - exclusive
#             license, under Apple's copyrights in this original Apple software ( the
#             "Apple Software" ), to use, reproduce, modify and redistribute the Apple
#             Software, with or without modifications, in source and / or binary forms;
#             provided that if you redistribute the Apple Software in its entirety and
#             without modifications, you must retain this notice and the following text
#             and disclaimers in all such redistributions of the Apple Software. Neither
#             the name, trademarks, service marks or logos of Apple Inc. may be used to
#             endorse or promote products derived from the Apple Software without specific
#             prior written permission from Apple.  Except as expressly stated in this
#             notice, no other rights or licenses, express or implied, are granted by
#             Apple herein, including but not limited to any patent rights that may be
#             infringed by your derivative works or by other works in which the Apple
#             Software may be incorporated.
#
#             The Apple Software is provided by Apple on an "AS IS" basis.  APPLE MAKES NO
#             WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED
#             WARRANTIES OF NON - INFRINGEMENT, MERCHANTABILITY AND FITNESS FOR A
#             PARTICULAR PURPOSE, REGARDING THE APPLE SOFTWARE OR ITS USE AND OPERATION
#             ALONE OR IN COMBINATION WITH YOUR PRODUCTS.
#
#             IN NO EVENT SHALL APPLE BE LIABLE FOR ANY SPECIAL, INDIRECT, INCIDENTAL OR
#             CONSEQUENTIAL DAMAGES ( INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
#             SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
#             INTERRUPTION ) ARISING IN ANY WAY OUT OF THE USE, REPRODUCTION, MODIFICATION
#             AND / OR DISTRIBUTION OF THE APPLE SOFTWARE, HOWEVER CAUSED AND WHETHER
#             UNDER THEORY OF CONTRACT, TORT ( INCLUDING NEGLIGENCE ), STRICT LIABILITY OR
#             OTHERWISE, EVEN IF APPLE HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# Copyright ( C ) 2012 Apple Inc. All Rights Reserved.
#
require 'json'
require 'sign_pass'

class SamplePass
  attr_accessor :pass_json, :raw_pass_path, :pass_output_path, :certificate_path, :certificate_password, :wwdr_certificate_path
  
  def initialize(raw_pass_path, certificate_path, certificate_password, wwdr_certificate_path, pass_output_path=nil)
    self.raw_pass_path = raw_pass_path
    self.certificate_path = certificate_path
    self.certificate_password = certificate_password
    self.wwdr_certificate_path = wwdr_certificate_path
    
    if pass_output_path
      self.pass_output_path = pass_output_path
    else
      name = self.raw_pass_path.split("/").last
      self.pass_output_path = File.absolute_path("#{self.raw_pass_path}/../#{name}.pkpass")
    end
    
    self.pass_json = JSON.parse(File.read("#{self.raw_pass_path}/pass.json"))
  end
  
  def change_gate
    old_gate_number = self.pass_json["boardingPass"]["headerFields"].select{|i| i["key"] == "gate"}.first["value"].to_i
    
    # Update the gate information
    if RUBY_VERSION == "1.8.7"
      gate_number = (1..98).to_a.choice
    else
      gate_number = (1..98).to_a.sample
    end
    
    # Checks to make sure the new gate number choosen is different from the old gate
    if old_gate_number == gate_number
      gate_number.to_i += 1
    end
    self.pass_json["boardingPass"]["headerFields"].select{|i| i["key"] == "gate"}.first["value"] = gate_number.to_s
    
    return gate_number
    
  end
  
  def save!
    # Write out the updated JSON
    File.open("#{self.raw_pass_path}/pass.json", "w") do |f|
      f.write JSON.pretty_generate(self.pass_json)
    end
    
    
    # Prepare for pass signing
    # Remove the old pass if it exists
    if File.exists?(self.pass_output_path)
      File.delete(self.pass_output_path)
    end
    
    # Generate and sign the new pass
    puts "params: #{[self.raw_pass_path, self.certificate_path, self.certificate_password, self.wwdr_certificate_path, self.pass_output_path]}"
    pass_signer = SignPass.new(self.raw_pass_path, self.certificate_path, self.certificate_password, self.wwdr_certificate_path, self.pass_output_path)
    pass_signer.sign_pass!
    
  end  
end
